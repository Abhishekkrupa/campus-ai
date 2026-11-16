const { User, Follow, Connection, CreatorProfile, Notification, Activity } = require('../models');
const { roles } = require('../utils/constants');
const { escapeRegExp, toString } = require('../utils/sanitize');

const publicUser = (user) => {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  return u;
};

const normalizePhone = (phone) => String(phone || '').replace(/[\s\-().]/g, '');

const findByPhone = async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone);
    if (!phone) return res.status(400).json({ message: 'Phone number required' });
    const user = await User.findOne({ phone }).select('name username avatar bio department isVerified role phone');
    if (!user) return res.status(404).json({ message: 'No user found with this phone number' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username: username.toLowerCase() }).populate({ path: 'creatorId', select: '-__v' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const data = publicUser(user);
    if (req.user) {
      data.viewerFollows = !!(await Follow.findOne({ follower: req.user._id, following: user._id }));
      const conn = await Connection.findOne({
        $or: [
          { requester: req.user._id, recipient: user._id },
          { requester: user._id, recipient: req.user._id },
        ],
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
    const user = await User.findById(req.params.id).populate({ path: 'creatorId', select: '-__v' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const data = publicUser(user);
    data.followers = await Follow.countDocuments({ following: user._id });
    data.following = await Follow.countDocuments({ follower: user._id });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (String(user._id) !== String(req.user._id) && req.user.role !== roles.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const fields = ['name', 'avatar', 'coverImage', 'phone', 'bio', 'department', 'college', 'course', 'semester', 'skills', 'subjects', 'education', 'experience', 'projects', 'certifications', 'achievements', 'socialLinks'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    });
    if (req.body.phone !== undefined) user.phone = normalizePhone(req.body.phone);
    await user.save();
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const follow = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (String(target._id) === String(req.user._id)) return res.status(400).json({ message: 'Cannot follow yourself' });

    let follow = await Follow.findOne({ follower: req.user._id, following: target._id });
    if (follow) return res.json({ following: true });

    follow = await Follow.create({ follower: req.user._id, following: target._id });
    target.followersCount += 1;
    req.user.followingCount += 1;
    await target.save();
    await req.user.save();

    if (String(target._id) !== String(req.user._id)) {
      await Notification.create({
        user: target._id,
        type: 'follower',
        category: 'Social',
        actor: req.user._id,
        title: 'New follower',
        message: `${req.user.name} started following you`,
        link: `/profile/${req.user.username}`,
      });
    }
    await Activity.create({ user: req.user._id, type: 'follow', targetType: 'User', targetId: target._id });
    res.json({ following: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const unfollow = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    await Follow.deleteOne({ follower: req.user._id, following: target._id });
    target.followersCount = Math.max(0, target.followersCount - 1);
    req.user.followingCount = Math.max(0, req.user.followingCount - 1);
    await target.save();
    await req.user.save();
    res.json({ following: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const followers = async (req, res) => {
  try {
    const followers = await Follow.find({ following: req.params.id }).populate('follower', 'name username avatar bio department subjects isVerified role');
    res.json(followers.map((f) => publicUser(f.follower)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const following = async (req, res) => {
  try {
    const following = await Follow.find({ follower: req.params.id }).populate('following', 'name username avatar bio department subjects isVerified role');
    res.json(following.map((f) => publicUser(f.following)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const checkProfile = async (userId) => {
  return await Follow.findOne({ follower: userId });
};

const searchUsers = async (req, res) => {
  try {
    const q = toString(req.query.q, 100);
    const filter = q
      ? { $or: [{ name: { $regex: escapeRegExp(q), $options: 'i' } }, { username: { $regex: escapeRegExp(q), $options: 'i' } }, { department: { $regex: escapeRegExp(q), $options: 'i' } }] }
      : {};
    const users = await User.find(filter).limit(20).select('name username avatar bio department college subjects role isVerified');
    res.json(users.map(publicUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---- Connections ----

const sendConnection = async (req, res) => {
  try {
    const recipient = await User.findById(req.params.id);
    if (!recipient) return res.status(404).json({ message: 'User not found' });
    if (String(recipient._id) === String(req.user._id)) return res.status(400).json({ message: 'Cannot connect with yourself' });
    let conn = await Connection.findOne({ requester: req.user._id, recipient: recipient._id });
    if (!conn) {
      conn = await Connection.findOne({ requester: recipient._id, recipient: req.user._id });
    }
    if (conn) {
      if (conn.status === 'pending') return res.json({ status: 'pending' });
      if (conn.status === 'accepted') return res.json({ status: 'accepted' });
    }
    conn = await Connection.create({ requester: req.user._id, recipient: recipient._id, status: 'pending' });
    recipient.connectionsCount = 0;
    await Notification.create({
      user: recipient._id,
      type: 'connection_request',
      category: 'Social',
      actor: req.user._id,
      title: 'Connection request',
      message: `${req.user.name} sent you a connection request`,
      link: `/profile/${req.user.username}`,
    });
    res.json({ status: 'pending' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const respondConnection = async (req, res) => {
  try {
    const conn = await Connection.findOne({ requester: req.params.id, recipient: req.user._id, status: 'pending' });
    if (!conn) return res.status(404).json({ message: 'Request not found' });
    const { action } = req.body;
    if (action === 'accept') {
      conn.status = 'accepted';
      await conn.save();
      await User.updateOne({ _id: req.user._id }, { $inc: { connectionsCount: 1 } });
      await User.updateOne({ _id: conn.requester }, { $inc: { connectionsCount: 1 } });
      const requester = await User.findById(conn.requester);
      await Notification.create({
        user: conn.requester,
        type: 'connection_accepted',
        category: 'Social',
        actor: req.user._id,
        title: 'Connection accepted',
        message: `${req.user.name} accepted your connection request`,
        link: `/profile/${req.user.username}`,
      });
      res.json({ status: 'accepted' });
    } else {
      conn.status = 'rejected';
      await conn.save();
      res.json({ status: 'rejected' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const removeConnection = async (req, res) => {
  try {
    await Connection.deleteMany({
      $or: [
        { requester: req.user._id, recipient: req.params.id, status: 'accepted' },
        { requester: req.params.id, recipient: req.user._id, status: 'accepted' },
      ],
    });
    await User.updateOne({ _id: req.user._id }, { $inc: { connectionsCount: -1 } });
    await User.updateOne({ _id: req.params.id }, { $inc: { connectionsCount: -1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getConnections = async (req, res) => {
  try {
    const [a, b] = await Promise.all([
      Connection.find({ requester: req.params.id, status: 'accepted' }).populate('recipient', 'name username avatar bio department subjects isVerified role'),
      Connection.find({ recipient: req.params.id, status: 'accepted' }).populate('requester', 'name username avatar bio department subjects isVerified role'),
    ]);
    const ids = new Set();
    const result = [];
    [...a, ...b].forEach((c) => {
      const u = c.recipient || c.requester;
      if (u && !ids.has(String(u._id))) {
        ids.add(String(u._id));
        result.push(publicUser(u));
      }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---- Creator switch / upgrade ----

const switchToCreator = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.accountType = 'CREATOR';
    user.role = roles.CREATOR;
    await user.save();
    let cp = await CreatorProfile.findOne({ user: user._id });
    if (!cp) {
      cp = await CreatorProfile.create({ user: user._id, category: req.body.category || '', bio: req.body.bio || user.bio || '', expertise: req.body.expertise || [], subjects: req.body.subjects || user.subjects || [] });
    }
    await User.updateOne({ _id: user._id }, { creatorId: cp._id });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateCreatorProfile = async (req, res) => {
  try {
    let cp = await CreatorProfile.findOne({ user: req.user._id });
    if (!cp) cp = await CreatorProfile.create({ user: req.user._id });
    const fields = ['category', 'expertise', 'subjects', 'bio', 'tagline', 'socialLinks'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) cp[f] = req.body[f];
    });
    await cp.save();
    if (req.body.subjects) await User.updateOne({ _id: req.user._id }, { $set: { subjects: req.body.subjects } });
    await Activity.create({ user: req.user._id, type: 'profile_update', targetType: 'CreatorProfile', targetId: cp._id });
    res.json(cp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const requestVerification = async (req, res) => {
  try {
    let cp = await CreatorProfile.findOne({ user: req.user._id });
    if (!cp) return res.status(403).json({ message: 'Create a creator profile first' });
    cp.verificationRequest = { requested: true, reason: req.body.reason || '' };
    await cp.save();
    await User.updateOne({ _id: req.user._id }, { verificationStatus: 'pending' });
    res.json({ requested: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const creatorPublic = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() }).populate({ path: 'creatorId', select: '-__v' });
    if (!user || !user.creatorId) return res.status(404).json({ message: 'Creator not found' });
    const data = publicUser(user);
    if (req.user) data.viewerFollows = !!(await Follow.findOne({ follower: req.user._id, following: user._id }));
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
