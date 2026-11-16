const { Article, Like, Bookmark, Activity } = require('../models');
const { toString, toInt } = require('../utils/sanitize');

const createArticle = async (req, res) => {
  try {
    const { title, subtitle, content, cover, tags, subject } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content required' });
    const words = String(content).split(/\s+/).length;
    const article = await Article.create({
      author: req.user._id,
      title,
      subtitle,
      content,
      cover,
      tags,
      subject,
      readingTime: Math.ceil(words / 200),
    });
    await Activity.create({ user: req.user._id, type: 'create_article', targetType: 'Article', targetId: article._id, metadata: { title, subject, tags } });
    res.status(201).json(article);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getArticle = async (req, res) => {
  try {
    const article = await Article.findOneAndUpdate({ _id: req.params.id, status: 'published' }, { $inc: { views: 1 } }, { new: true }).populate('author', 'name username avatar bio department isVerified role');
    if (!article) return res.status(404).json({ message: 'Article not found' });
    const data = article.toObject();
    if (req.user) {
      data.liked = !!(await Like.findOne({ user: req.user._id, targetType: 'Article', targetId: article._id }));
      data.saved = !!(await Bookmark.findOne({ user: req.user._id, targetType: 'Article', targetId: article._id }));
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listArticles = async (req, res) => {
  try {
    const { author, page, limit } = req.query;
    const filter = { status: 'published' };
    const authorId = toString(author, 100);
    if (authorId) filter.author = authorId;
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const articles = await Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('author', 'name username avatar bio department isVerified role');
    res.json(articles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ message: 'Article not found' });
    const existing = await Like.findOne({ user: req.user._id, targetType: 'Article', targetId: article._id });
    if (existing) {
      await existing.deleteOne();
      article.likesCount = Math.max(0, article.likesCount - 1);
      await article.save();
      return res.json({ liked: false });
    }
    await Like.create({ user: req.user._id, targetType: 'Article', targetId: article._id });
    article.likesCount += 1;
    await article.save();
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createArticle, getArticle, listArticles, toggleLike };
