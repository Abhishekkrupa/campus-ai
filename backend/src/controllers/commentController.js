const { prisma, createId, userId: reqUserId } = require('../utils/prisma');
const { toString, toEnum } = require('../utils/sanitize');

const VALID = ['Post', 'Video', 'Note', 'Article'];

const populateAuthor = async (items) => {
  const arr = Array.isArray(items) ? items : [items];
  const ids = [...new Set(arr.map((c) => c.author).filter(Boolean))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
  const map = Object.fromEntries(users.map((u) => [u.id, { _id: u.id, name: u.name, username: u.username, avatar: u.avatar, bio: u.bio, department: u.department, isVerified: u.isVerified, role: u.role }]));
  const apply = (c) => ({ ...c, _id: c.id, author: map[c.author] || c.author });
  return Array.isArray(items) ? arr.map(apply) : apply(arr[0]);
};

const addComment = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { targetType, targetId, content, parent } = req.body;
    if (!VALID.includes(targetType)) return res.status(400).json({ message: 'Invalid target type' });
    const model = targetType.charAt(0).toLowerCase() + targetType.slice(1);
    const target = await prisma[model].findUnique({ where: { id: targetId } }).catch(() => null);
    if (!target) return res.status(404).json({ message: 'Target not found' });
    const comment = await prisma.comment.create({ data: { id: createId(), author: uid, targetType, targetId, content, parent: parent || null } });
    await prisma[model].update({ where: { id: targetId }, data: { commentsCount: { increment: 1 } } }).catch(() => {});
    const owner = target.author || target.creator;
    if (owner && String(owner) !== String(uid)) {
      await prisma.notification.create({ data: { id: createId(), user: owner, type: 'comment', category: 'Social', actor: uid, title: 'New comment', message: `${req.user.name} commented: ${String(content).slice(0, 60)}`, link: `/${targetType.toLowerCase()}/${targetId}` } }).catch(() => {});
    }
    const populated = await populateAuthor(comment);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listComments = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { targetType, targetId } = req.query;
    const typeValue = toEnum(targetType, VALID);
    if (!typeValue) return res.status(400).json({ message: 'Invalid target type' });
    const targetIdValue = toString(targetId, 100);
    const comments = await prisma.comment.findMany({ where: { targetType: typeValue, targetId: targetIdValue, parent: null, status: 'active' }, orderBy: { createdAt: 'desc' } });
    const populated = await populateAuthor(comments);
    const rich = await Promise.all(populated.map(async (c) => {
      const replies = await prisma.comment.findMany({ where: { parent: c.id, status: 'active' }, orderBy: { createdAt: 'asc' } });
      c.replies = await populateAuthor(replies);
      c.liked = uid ? !!(await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Comment', targetId: c.id } } }).catch(() => null)) : false;
      return c;
    }));
    res.json(rich);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (String(comment.author) !== String(uid) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') return res.status(403).json({ message: 'Forbidden' });
    await prisma.comment.update({ where: { id: comment.id }, data: { status: 'removed' } });
    const model = comment.targetType.charAt(0).toLowerCase() + comment.targetType.slice(1);
    const target = await prisma[model].findUnique({ where: { id: comment.targetId } }).catch(() => null);
    if (target) await prisma[model].update({ where: { id: comment.targetId }, data: { commentsCount: Math.max(0, (target.commentsCount || 1) - 1) } }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addComment, listComments, deleteComment };
