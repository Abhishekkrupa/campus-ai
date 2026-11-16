const { prisma, createId, toPublicUser, userId: reqUserId } = require('../utils/prisma');
const { toString, toInt } = require('../utils/sanitize');

const POST_TYPES = ['text', 'image', 'video', 'note', 'article', 'quiz', 'announcement'];
const MEDIA_URL_RE = /^\/uploads\/|^https?:\/\//i;

const populateAuthor = async (items) => {
  const arr = Array.isArray(items) ? items : [items];
  const ids = [...new Set(arr.map((p) => p.author).filter(Boolean))];
  if (!ids.length) return items;
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const map = Object.fromEntries(users.map((u) => [u.id, { _id: u.id, name: u.name, username: u.username, avatar: u.avatar, bio: u.bio, department: u.department, isVerified: u.isVerified, role: u.role }]));
  const apply = (p) => ({ ...p, _id: p.id, author: map[p.author] || p.author });
  return Array.isArray(items) ? arr.map(apply) : apply(arr[0]);
};

const withFlags = async (post, userId) => {
  const data = { ...post, _id: post.id };
  if (userId) {
    const [liked, saved] = await Promise.all([
      prisma.like.findUnique({ where: { user_targetType_targetId: { user: userId, targetType: 'Post', targetId: post.id } } }).catch(() => null),
      prisma.bookmark.findUnique({ where: { user_targetType_targetId: { user: userId, targetType: 'Post', targetId: post.id } } }).catch(() => null),
    ]);
    data.liked = !!liked;
    data.saved = !!saved;
  }
  return data;
};

const createPost = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { content, type = 'text', media = [], tags = [], subject, department } = req.body;
    const safeType = POST_TYPES.includes(type) ? type : 'text';
    const safeMedia = Array.isArray(media) ? media.map((m) => toString(m, 500)).filter((m) => MEDIA_URL_RE.test(m)).slice(0, 6) : [];
    const safeTags = Array.isArray(tags) ? tags.map((t) => toString(t, 40)).filter(Boolean).slice(0, 12) : [];
    const post = await prisma.post.create({
      data: {
        id: createId(), author: uid, content: toString(content, 5000), type: safeType,
        media: safeMedia, tags: safeTags, subject: toString(subject, 200), department: toString(department, 200),
      },
    });
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'create_post', targetType: 'Post', targetId: post.id, metadata: { content, subject, tags } } }).catch(() => {});
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (user) {
      const g = user.gamification || { xp: 0, level: 1, streaks: 0, badges: [] };
      g.xp = (g.xp || 0) + 10;
      await prisma.user.update({ where: { id: uid }, data: { gamification: g } }).catch(() => {});
    }
    res.status(201).json({ ...post, _id: post.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPost = async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const updated = await prisma.post.update({ where: { id: post.id }, data: { views: { increment: 1 } } });
    let data = await populateAuthor(updated);
    data = await withFlags(data, reqUserId(req));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listPosts = async (req, res) => {
  try {
    const { page, limit, author, subject, type, authorId } = req.query;
    const where = { status: 'active' };
    if (author) where.author = toString(author, 100);
    if (authorId) where.author = toString(authorId, 100);
    if (subject) where.subject = toString(subject, 200);
    if (type) where.type = toString(type, 50);
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const posts = await prisma.post.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum, take: limitNum,
    });
    const populated = await populateAuthor(posts);
    const uid = reqUserId(req);
    const list = await Promise.all(populated.map((p) => withFlags(p, uid)));
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const followingFeed = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const follows = await prisma.follow.findMany({ where: { follower: uid } });
    const ids = follows.map((f) => f.following);
    const posts = await prisma.post.findMany({ where: { author: { in: ids }, status: 'active' }, orderBy: { createdAt: 'desc' }, take: 30 });
    res.json(await populateAuthor(posts));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const trendingFeed = async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const posts = await prisma.post.findMany({
      where: { status: 'active', createdAt: { gte: since } },
      orderBy: [{ views: 'desc' }, { likesCount: 'desc' }, { sharesCount: 'desc' }, { commentsCount: 'desc' }],
      take: 30,
    });
    res.json(await populateAuthor(posts));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePost = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (String(post.author) !== String(uid) && req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ message: 'Forbidden' });
    const data = {};
    if (req.body.content !== undefined) data.content = toString(req.body.content, 5000);
    if (req.body.subject !== undefined) data.subject = toString(req.body.subject, 200);
    if (req.body.tags !== undefined) data.tags = Array.isArray(req.body.tags) ? req.body.tags.map((t) => toString(t, 40)).filter(Boolean).slice(0, 12) : [];
    if (req.body.media !== undefined) data.media = Array.isArray(req.body.media) ? req.body.media.map((m) => toString(m, 500)).filter((m) => MEDIA_URL_RE.test(m)).slice(0, 6) : [];
    const updated = await prisma.post.update({ where: { id: post.id }, data });
    res.json({ ...updated, _id: updated.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (String(post.author) !== String(uid) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') return res.status(403).json({ message: 'Forbidden' });
    await prisma.post.update({ where: { id: post.id }, data: { status: 'removed' } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const existing = await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Post', targetId: post.id } } }).catch(() => null);
    if (existing) {
      await prisma.$transaction([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id: post.id }, data: { likesCount: { decrement: 1 } } }),
      ]);
      const p = await prisma.post.findUnique({ where: { id: post.id } });
      return res.json({ liked: false, likesCount: Math.max(0, p.likesCount) });
    }
    await prisma.$transaction([
      prisma.like.create({ data: { id: createId(), user: uid, targetType: 'Post', targetId: post.id } }),
      prisma.post.update({ where: { id: post.id }, data: { likesCount: { increment: 1 } } }),
    ]);
    if (String(post.author) !== String(uid)) {
      await prisma.notification.create({ data: { id: createId(), user: post.author, type: 'post_like', category: 'Social', actor: uid, title: 'New like', message: `${req.user.name} liked your post`, link: `/feed`, metadata: { post: post.id } } }).catch(() => {});
    }
    const p = await prisma.post.findUnique({ where: { id: post.id } });
    res.json({ liked: true, likesCount: p.likesCount });
  } catch (err) {
    if (err.code === 'P2002') return res.json({ liked: true });
    res.status(500).json({ message: err.message });
  }
};

const toggleSave = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const existing = await prisma.bookmark.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Post', targetId: post.id } } }).catch(() => null);
    if (existing) {
      await prisma.$transaction([
        prisma.bookmark.delete({ where: { id: existing.id } }),
        prisma.post.update({ where: { id: post.id }, data: { savesCount: { decrement: 1 } } }),
      ]);
      return res.json({ saved: false });
    }
    await prisma.$transaction([
      prisma.bookmark.create({ data: { id: createId(), user: uid, targetType: 'Post', targetId: post.id } }),
      prisma.post.update({ where: { id: post.id }, data: { savesCount: { increment: 1 } } }),
    ]);
    res.json({ saved: true });
  } catch (err) {
    if (err.code === 'P2002') return res.json({ saved: true });
    res.status(500).json({ message: err.message });
  }
};

const sharePost = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const updated = await prisma.post.update({ where: { id: post.id }, data: { sharesCount: { increment: 1 } } });
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'share', targetType: 'Post', targetId: post.id } }).catch(() => {});
    if (String(post.author) !== String(uid)) {
      await prisma.notification.create({ data: { id: createId(), user: post.author, type: 'share', category: 'Social', actor: uid, title: 'New share', message: `${req.user.name} shared your post`, link: '/feed' } }).catch(() => {});
    }
    res.json({ shared: true, sharesCount: updated.sharesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createPost, getPost, listPosts, followingFeed, trendingFeed, updatePost, deletePost, toggleLike, toggleSave, sharePost };
