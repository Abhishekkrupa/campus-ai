const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const { prisma, toPublicUser, userId: reqUserId, createId } = require('../utils/prisma');
const { roles } = require('../utils/constants');
const { escapeRegExp, toString } = require('../utils/sanitize');

const normalizePhone = (phone) => String(phone || '').replace(/[\s\-().]/g, '');

const publicUser = toPublicUser;

const includeCreator = async (user) => {
  if (!user) return user;
  if (user.creatorId) {
    const cp = await prisma.creatorProfile.findUnique({ where: { id: user.creatorId } });
    return { ...user, creatorId: cp || null };
  }
  const cp = await prisma.creatorProfile.findUnique({ where: { user: user.id } }).catch(() => null);
  if (cp) return { ...user, creatorId: cp };
  return user;
};

const findByPhone = async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);
    if (!phone) return res.status(400).json({ message: 'Phone number required' });
    const user = await prisma.user.findFirst({ where: { phone }, select: { id: true, name: true, username: true, avatar: true, bio: true, department: true, isVerified: true, role: true, phone: true } });
    if (!user) return res.status(404).json({ message: 'No user found with this phone number' });
    res.json({ ...user, _id: user.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    let user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user = await includeCreator(user);
    const data = publicUser(user);
    const viewerId = reqUserId(req);
    if (viewerId) {
      data.viewerFollows = !!(await prisma.follow.findUnique({ where: { follower_following: { follower: viewerId, following: user.id } } }).catch(() => null));
      const conn = await prisma.connection.findFirst({
        where: {
          OR: [
            { requester: viewerId, recipient: user.id },
            { requester: user.id, recipient: viewerId },
          ],
        },
      });
      data.connectionState = conn ? conn.status : 'none';
      data.isBlocked = false;
    } else {
      data.viewerFollows = false;
      data.connectionState = 'none';
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    let user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user = await includeCreator(user);
    const data = publicUser(user);
    data.followers = await prisma.follow.count({ where: { following: user.id } });
    data.following = await prisma.follow.count({ where: { follower: user.id } });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const viewerId = reqUserId(req);
    if (String(user.id) !== String(viewerId) && req.user.role !== roles.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const fields = ['name', 'avatar', 'coverImage', 'phone', 'bio', 'department', 'college', 'course', 'semester', 'skills', 'subjects', 'education', 'experience', 'projects', 'certifications', 'achievements'];
    const data = {};
    fields.forEach((f) => {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    });
    if (req.body.phone !== undefined) data.phone = normalizePhone(req.body.phone);
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json(publicUser(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const follow = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (String(target.id) === String(viewerId)) return res.status(400).json({ message: 'Cannot follow yourself' });

    const existing = await prisma.follow.findUnique({ where: { follower_following: { follower: viewerId, following: target.id } } }).catch(() => null);
    if (existing) return res.json({ following: true });

    await prisma.$transaction([
      prisma.follow.create({ data: { id: createId(), follower: viewerId, following: target.id } }),
      prisma.user.update({ where: { id: target.id }, data: { followersCount: { increment: 1 } } }),
      prisma.user.update({ where: { id: viewerId }, data: { followingCount: { increment: 1 } } }),
    ]);

    await prisma.notification.create({
      data: {
        id: createId(),
        user: target.id,
        type: 'follower',
        category: 'Social',
        actor: viewerId,
        title: 'New follower',
        message: `${req.user.name} started following you`,
        link: `/profile/${req.user.username}`,
      },
    }).catch(() => {});
    await prisma.activity.create({ data: { id: createId(), user: viewerId, type: 'follow', targetType: 'User', targetId: target.id } }).catch(() => {});
    res.json({ following: true });
  } catch (err) {
    if (err.code === 'P2002') return res.json({ following: true });
    res.status(500).json({ message: err.message });
  }
};

const unfollow = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    const existing = await prisma.follow.findUnique({ where: { follower_following: { follower: viewerId, following: target.id } } }).catch(() => null);
    if (existing) {
      await prisma.$transaction([
        prisma.follow.delete({ where: { follower_following: { follower: viewerId, following: target.id } } }),
        prisma.user.update({ where: { id: target.id }, data: { followersCount: { decrement: 1 } } }),
        prisma.user.update({ where: { id: viewerId }, data: { followingCount: { decrement: 1 } } }),
      ]).catch(() => {});
    }
    // clamp
    await prisma.user.update({ where: { id: target.id }, data: { followersCount: Math.max(0, (await prisma.user.findUnique({ where: { id: target.id } }))?.followersCount || 0) } }).catch(() => {});
    res.json({ following: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const mapUsers = async (ids, selectExtra = {}) => {
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const byId = Object.fromEntries(users.map((u) => [u.id, publicUser(u)]));
  return ids.map((id) => byId[id]).filter(Boolean);
};

const followers = async (req, res) => {
  try {
    const rows = await prisma.follow.findMany({ where: { following: req.params.id } });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.follower) } } });
    res.json(users.map((u) => {
      const p = publicUser(u);
      return { _id: p._id, name: p.name, username: p.username, avatar: p.avatar, bio: p.bio, department: p.department, subjects: p.subjects, isVerified: p.isVerified, role: p.role };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const following = async (req, res) => {
  try {
    const rows = await prisma.follow.findMany({ where: { follower: req.params.id } });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.following) } } });
    res.json(users.map((u) => {
      const p = publicUser(u);
      return { _id: p._id, name: p.name, username: p.username, avatar: p.avatar, bio: p.bio, department: p.department, subjects: p.subjects, isVerified: p.isVerified, role: p.role };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const checkProfile = async (userId) => prisma.follow.findFirst({ where: { follower: userId } });

const searchUsers = async (req, res) => {
  try {
    const q = toString(req.query.q, 100);
    const where = q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { department: { contains: q, mode: 'insensitive' } },
      ],
    } : {};
    const users = await prisma.user.findMany({ where, take: 20 });
    res.json(users.map((u) => {
      const p = publicUser(u);
      return { _id: p._id, name: p.name, username: p.username, avatar: p.avatar, bio: p.bio, department: p.department, college: p.college, subjects: p.subjects, role: p.role, isVerified: p.isVerified };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendConnection = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    const recipient = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!recipient) return res.status(404).json({ message: 'User not found' });
    if (String(recipient.id) === String(viewerId)) return res.status(400).json({ message: 'Cannot connect with yourself' });
    let conn = await prisma.connection.findFirst({ where: { requester: viewerId, recipient: recipient.id } });
    if (!conn) conn = await prisma.connection.findFirst({ where: { requester: recipient.id, recipient: viewerId } });
    if (conn) {
      if (conn.status === 'pending') return res.json({ status: 'pending' });
      if (conn.status === 'accepted') return res.json({ status: 'accepted' });
    }
    await prisma.connection.create({ data: { id: createId(), requester: viewerId, recipient: recipient.id, status: 'pending' } });
    await prisma.notification.create({
      data: { id: createId(), user: recipient.id, type: 'connection_request', category: 'Social', actor: viewerId, title: 'Connection request', message: `${req.user.name} sent you a connection request`, link: `/profile/${req.user.username}` },
    }).catch(() => {});
    res.json({ status: 'pending' });
  } catch (err) {
    if (err.code === 'P2002') return res.json({ status: 'pending' });
    res.status(500).json({ message: err.message });
  }
};

const respondConnection = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    const conn = await prisma.connection.findFirst({ where: { requester: req.params.id, recipient: viewerId, status: 'pending' } });
    if (!conn) return res.status(404).json({ message: 'Request not found' });
    const { action } = req.body;
    if (action === 'accept') {
      await prisma.$transaction([
        prisma.connection.update({ where: { id: conn.id }, data: { status: 'accepted' } }),
        prisma.user.update({ where: { id: viewerId }, data: { connectionsCount: { increment: 1 } } }),
        prisma.user.update({ where: { id: conn.requester }, data: { connectionsCount: { increment: 1 } } }),
      ]);
      await prisma.notification.create({
        data: { id: createId(), user: conn.requester, type: 'connection_accepted', category: 'Social', actor: viewerId, title: 'Connection accepted', message: `${req.user.name} accepted your connection request`, link: `/profile/${req.user.username}` },
      }).catch(() => {});
      res.json({ status: 'accepted' });
    } else {
      await prisma.connection.update({ where: { id: conn.id }, data: { status: 'rejected' } });
      res.json({ status: 'rejected' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const removeConnection = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    await prisma.connection.deleteMany({
      where: {
        OR: [
          { requester: viewerId, recipient: req.params.id, status: 'accepted' },
          { requester: req.params.id, recipient: viewerId, status: 'accepted' },
        ],
      },
    });
    await prisma.user.update({ where: { id: viewerId }, data: { connectionsCount: { decrement: 1 } } }).catch(() => {});
    await prisma.user.update({ where: { id: req.params.id }, data: { connectionsCount: { decrement: 1 } } }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getConnections = async (req, res) => {
  try {
    const [a, b] = await Promise.all([
      prisma.connection.findMany({ where: { requester: req.params.id, status: 'accepted' } }),
      prisma.connection.findMany({ where: { recipient: req.params.id, status: 'accepted' } }),
    ]);
    const ids = [...new Set([...a.map((c) => c.recipient), ...b.map((c) => c.requester)])];
    const users = await prisma.user.findMany({ where: { id: { in: ids } } });
    res.json(users.map((u) => {
      const p = publicUser(u);
      return { _id: p._id, name: p.name, username: p.username, avatar: p.avatar, bio: p.bio, department: p.department, subjects: p.subjects, isVerified: p.isVerified, role: p.role };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const switchToCreator = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    let user = await prisma.user.update({ where: { id: viewerId }, data: { accountType: 'CREATOR', role: roles.CREATOR } });
    let cp = await prisma.creatorProfile.findUnique({ where: { user: user.id } }).catch(() => null);
    if (!cp) {
      cp = await prisma.creatorProfile.create({ data: { id: createId(), user: user.id, category: req.body.category || '', bio: req.body.bio || user.bio || '', expertise: req.body.expertise || [], subjects: req.body.subjects || user.subjects || [] } });
    }
    user = await prisma.user.update({ where: { id: user.id }, data: { creatorId: cp.id } });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateCreatorProfile = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    let cp = await prisma.creatorProfile.findUnique({ where: { user: viewerId } }).catch(() => null);
    if (!cp) cp = await prisma.creatorProfile.create({ data: { id: createId(), user: viewerId } });
    const fields = ['category', 'expertise', 'subjects', 'bio', 'tagline', 'socialLinks'];
    const data = {};
    fields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    cp = await prisma.creatorProfile.update({ where: { id: cp.id }, data });
    if (req.body.subjects) await prisma.user.update({ where: { id: viewerId }, data: { subjects: req.body.subjects } }).catch(() => {});
    await prisma.activity.create({ data: { id: createId(), user: viewerId, type: 'profile_update', targetType: 'CreatorProfile', targetId: cp.id } }).catch(() => {});
    res.json({ ...cp, _id: cp.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const requestVerification = async (req, res) => {
  try {
    const viewerId = reqUserId(req);
    let cp = await prisma.creatorProfile.findUnique({ where: { user: viewerId } }).catch(() => null);
    if (!cp) return res.status(403).json({ message: 'Create a creator profile first' });
    cp = await prisma.creatorProfile.update({ where: { id: cp.id }, data: { verificationRequest: { requested: true, reason: req.body.reason || '' } } });
    await prisma.user.update({ where: { id: viewerId }, data: { verificationStatus: 'pending' } });
    res.json({ requested: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const creatorPublic = async (req, res) => {
  try {
    let user = await prisma.user.findUnique({ where: { username: req.params.username.toLowerCase() } });
    if (!user) return res.status(404).json({ message: 'Creator not found' });
    user = await includeCreator(user);
    if (!user.creatorId) return res.status(404).json({ message: 'Creator not found' });
    const data = publicUser(user);
    const viewerId = reqUserId(req);
    if (viewerId) data.viewerFollows = !!(await prisma.follow.findUnique({ where: { follower_following: { follower: viewerId, following: user.id } } }).catch(() => null));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getByUsername,
  getProfile,
  updateUser,
  findByPhone,
  normalizePhone,
  follow,
  unfollow,
  followers,
  following,
  checkProfile,
  searchUsers,
  sendConnection,
  respondConnection,
  removeConnection,
  getConnections,
  switchToCreator,
  updateCreatorProfile,
  requestVerification,
  creatorPublic,
  publicUser,
};
