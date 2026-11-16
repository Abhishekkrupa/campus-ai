const { prisma, createId, userId: reqUserId } = require('../utils/prisma');
const { toString, toInt } = require('../utils/sanitize');

const populateAuthor = async (items) => {
  const arr = Array.isArray(items) ? items : [items];
  const ids = [...new Set(arr.map((a) => a.author).filter(Boolean))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
  const map = Object.fromEntries(users.map((u) => [u.id, { _id: u.id, name: u.name, username: u.username, avatar: u.avatar, bio: u.bio, department: u.department, isVerified: u.isVerified, role: u.role }]));
  const apply = (a) => ({ ...a, _id: a.id, author: map[a.author] || a.author });
  return Array.isArray(items) ? arr.map(apply) : apply(arr[0]);
};

const createArticle = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { title, subtitle, content, cover, tags, subject } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content required' });
    const words = String(content).split(/\s+/).length;
    const article = await prisma.article.create({ data: { id: createId(), author: uid, title, subtitle: subtitle || '', content, cover: cover || '', tags: tags || [], subject: subject || '', readingTime: Math.ceil(words / 200) } });
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'create_article', targetType: 'Article', targetId: article.id, metadata: { title, subject, tags } } }).catch(() => {});
    res.status(201).json({ ...article, _id: article.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getArticle = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article || article.status !== 'published') return res.status(404).json({ message: 'Article not found' });
    const updated = await prisma.article.update({ where: { id: article.id }, data: { views: { increment: 1 } } });
    let data = await populateAuthor(updated);
    if (uid) {
      data.liked = !!(await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Article', targetId: article.id } } }).catch(() => null));
      data.saved = !!(await prisma.bookmark.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Article', targetId: article.id } } }).catch(() => null));
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listArticles = async (req, res) => {
  try {
    const { author, page, limit } = req.query;
    const where = { status: 'published' };
    const authorId = toString(author, 100);
    if (authorId) where.author = authorId;
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const articles = await prisma.article.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * limitNum, take: limitNum });
    res.json(await populateAuthor(articles));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const article = await prisma.article.findUnique({ where: { id: req.params.id } });
    if (!article) return res.status(404).json({ message: 'Article not found' });
    const existing = await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Article', targetId: article.id } } }).catch(() => null);
    if (existing) {
      await prisma.$transaction([prisma.like.delete({ where: { id: existing.id } }), prisma.article.update({ where: { id: article.id }, data: { likesCount: { decrement: 1 } } })]);
      return res.json({ liked: false });
    }
    await prisma.$transaction([prisma.like.create({ data: { id: createId(), user: uid, targetType: 'Article', targetId: article.id } }), prisma.article.update({ where: { id: article.id }, data: { likesCount: { increment: 1 } } })]);
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createArticle, getArticle, listArticles, toggleLike };
