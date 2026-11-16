const { Comment, Notification, Post, Video, Note, Article, Like } = require('../models');
const { toString, toEnum } = require('../utils/sanitize');

const VALID = { Post, Video, Note, Article };
const VALID_TYPES = Object.keys(VALID);

const addComment = async (req, res) => {
  try {
    const { targetType, targetId, content, parent } = req.body;
    if (!VALID[targetType]) return res.status(400).json({ message: 'Invalid target type' });
    const target = await VALID[targetType].findById(targetId);
    if (!target) return res.status(404).json({ message: 'Target not found' });
    const comment = await Comment.create({ author: req.user._id, targetType, targetId, content, parent: parent || null });
    target.commentsCount = (target.commentsCount || 0) + 1;
    await target.save();
    const author = target.author || target.creator;
    if (author && String(author) !== String(req.user._id)) {
      await Notification.create({
        user: author,
        type: 'comment',
        category: 'Social',
        actor: req.user._id,
        title: 'New comment',
        message: `${req.user.name} commented: ${content.slice(0, 60)}`,
        link: `/${targetType.toLowerCase()}/${targetId}`,
      });
    }
    const populated = await Comment.findById(comment._id).populate('author', 'name username avatar bio department isVerified role');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listComments = async (req, res) => {
  try {
    const { targetType, targetId } = req.query;
    const typeValue = toEnum(targetType, VALID_TYPES);
    if (!typeValue) return res.status(400).json({ message: 'Invalid target type' });
    const targetIdValue = toString(targetId, 100);
    const comments = await Comment.find({ targetType: typeValue, targetId: targetIdValue, parent: null, status: 'active' })
      .sort({ createdAt: -1 })
      .populate('author', 'name username avatar bio department isVerified role');
    const rich = await Promise.all(comments.map(async (c) => {
      const d = c.toObject();
      d.replies = await Comment.find({ parent: c._id, status: 'active' }).sort({ createdAt: 1 }).populate('author', 'name username avatar bio department isVerified role');
      d.liked = req.user ? !!(await Like.findOne({ user: req.user._id, targetType: 'Comment', targetId: c._id })) : false;
      return d;
    }));
    res.json(rich);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (String(comment.author) !== String(req.user._id) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    comment.status = 'removed';
    await comment.save();
    const target = await VALID[comment.targetType].findById(comment.targetId);
    if (target) {
      target.commentsCount = Math.max(0, (target.commentsCount || 0) - 1);
      await target.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addComment, listComments, deleteComment };
