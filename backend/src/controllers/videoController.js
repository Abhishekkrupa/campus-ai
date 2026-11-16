const { prisma, createId, userId: reqUserId } = require('../utils/prisma');
const { toString, toInt } = require('../utils/sanitize');

const populateCreator = async (items) => {
  const arr = Array.isArray(items) ? items : [items];
  const ids = [...new Set(arr.map((v) => v.creator).filter(Boolean))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
  const map = Object.fromEntries(users.map((u) => [u.id, { _id: u.id, name: u.name, username: u.username, avatar: u.avatar, bio: u.bio, department: u.department, isVerified: u.isVerified, role: u.role }]));
  const apply = (v) => ({ ...v, _id: v.id, creator: map[v.creator] || v.creator });
  return Array.isArray(items) ? arr.map(apply) : apply(arr[0]);
};

const createVideo = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { title, description, videoUrl, thumbnail, duration, subject, department, tags } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });
    const video = await prisma.video.create({ data: { id: createId(), creator: uid, title, description: description || '', videoUrl: videoUrl || '', thumbnail: thumbnail || '', duration: Number(duration) || 0, subject: subject || '', department: department || '', tags: tags || [] } });
    const cp = await prisma.creatorProfile.findUnique({ where: { user: uid } }).catch(() => null);
    if (cp) await prisma.creatorProfile.update({ where: { id: cp.id }, data: { resourcesCount: { increment: 1 } } }).catch(() => {});
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'create_video', targetType: 'Video', targetId: video.id, metadata: { title, subject, tags } } }).catch(() => {});
    res.status(201).json({ ...video, _id: video.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getVideo = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video || video.status !== 'active') return res.status(404).json({ message: 'Video not found' });
    const updated = await prisma.video.update({ where: { id: video.id }, data: { views: { increment: 1 } } });
    const cp = await prisma.creatorProfile.findUnique({ where: { user: updated.creator } }).catch(() => null);
    if (cp) await prisma.creatorProfile.update({ where: { id: cp.id }, data: { views: { increment: 1 } } }).catch(() => {});
    let data = await populateCreator(updated);
    if (uid) {
      data.liked = !!(await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Video', targetId: video.id } } }).catch(() => null));
      data.saved = !!(await prisma.bookmark.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Video', targetId: video.id } } }).catch(() => null));
    }
    const related = await prisma.video.findMany({ where: { subject: video.subject, id: { not: video.id }, status: 'active' }, take: 6 });
    data.related = await populateCreator(related);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listVideos = async (req, res) => {
  try {
    const { page, limit, subject, creator, department, search } = req.query;
    const where = { status: 'active' };
    if (subject) where.subject = toString(subject, 200);
    if (creator) where.creator = toString(creator, 100);
    if (department) where.department = toString(department, 200);
    if (search) where.title = { contains: toString(search, 100), mode: 'insensitive' };
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const videos = await prisma.video.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * limitNum, take: limitNum });
    res.json(await populateCreator(videos));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) return res.status(404).json({ message: 'Video not found' });
    const existing = await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Video', targetId: video.id } } }).catch(() => null);
    if (existing) {
      await prisma.$transaction([prisma.like.delete({ where: { id: existing.id } }), prisma.video.update({ where: { id: video.id }, data: { likesCount: { decrement: 1 } } })]);
      const v = await prisma.video.findUnique({ where: { id: video.id } });
      return res.json({ liked: false, likesCount: Math.max(0, v.likesCount) });
    }
    await prisma.$transaction([prisma.like.create({ data: { id: createId(), user: uid, targetType: 'Video', targetId: video.id } }), prisma.video.update({ where: { id: video.id }, data: { likesCount: { increment: 1 } } })]);
    const v = await prisma.video.findUnique({ where: { id: video.id } });
    res.json({ liked: true, likesCount: v.likesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleSave = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) return res.status(404).json({ message: 'Video not found' });
    const existing = await prisma.bookmark.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Video', targetId: video.id } } }).catch(() => null);
    if (existing) {
      await prisma.$transaction([prisma.bookmark.delete({ where: { id: existing.id } }), prisma.video.update({ where: { id: video.id }, data: { savesCount: { decrement: 1 } } })]);
      return res.json({ saved: false });
    }
    await prisma.$transaction([prisma.bookmark.create({ data: { id: createId(), user: uid, targetType: 'Video', targetId: video.id } }), prisma.video.update({ where: { id: video.id }, data: { savesCount: { increment: 1 } } })]);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const video = await prisma.video.findUnique({ where: { id: req.params.id } });
    if (!video) return res.status(404).json({ message: 'Video not found' });
    if (String(video.creator) !== String(uid) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') return res.status(403).json({ message: 'Forbidden' });
    await prisma.video.update({ where: { id: video.id }, data: { status: 'removed' } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addWatchLater = async (req, res) => {
  try {
    const uid = reqUserId(req);
    let pl = await prisma.playlist.findFirst({ where: { owner: uid, type: 'watch-later' } });
    if (!pl) pl = await prisma.playlist.create({ data: { id: createId(), owner: uid, title: 'Watch Later', type: 'watch-later', items: [] } });
    const items = Array.isArray(pl.items) ? pl.items : [];
    if (!items.includes(req.params.id)) items.push(req.params.id);
    pl = await prisma.playlist.update({ where: { id: pl.id }, data: { items } });
    res.json({ added: true, count: items.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addHistory = async (req, res) => {
  try {
    const uid = reqUserId(req);
    let pl = await prisma.playlist.findFirst({ where: { owner: uid, type: 'history' } });
    if (!pl) pl = await prisma.playlist.create({ data: { id: createId(), owner: uid, title: 'History', type: 'history', items: [] } });
    let items = (Array.isArray(pl.items) ? pl.items : []).filter((i) => String(i) !== String(req.params.id));
    items.unshift(req.params.id);
    if (items.length > 100) items = items.slice(0, 100);
    await prisma.playlist.update({ where: { id: pl.id }, data: { items } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createVideo, getVideo, listVideos, toggleLike, toggleSave, deleteVideo, addWatchLater, addHistory };
