const { Post, Like, Comment, Bookmark, Notification, Activity, User } = require('../models');
const { toString, toInt } = require('../utils/sanitize');

const POST_TYPES = ['text', 'image', 'video', 'note', 'article', 'quiz', 'announcement'];
const MEDIA_URL_RE = /^\/uploads\/|^https?:\/\//i;

const createPost = async (req, res) => {
  try {
    const { content, type = 'text', media = [], tags = [], subject, department } = req.body;
    const safeType = POST_TYPES.includes(type) ? type : 'text';
    const safeMedia = Array.isArray(media)
      ? media.map((m) => toString(m, 500)).filter((m) => MEDIA_URL_RE.test(m)).slice(0, 6)
      : [];
    const safeTags = Array.isArray(tags)
      ? tags.map((t) => toString(t, 40)).filter(Boolean).slice(0, 12)
      : [];
    const post = await Post.create({
      author: req.user._id,
      content: toString(content, 5000),
      type: safeType,
      media: safeMedia,
      tags: safeTags,
      subject: toString(subject, 200),
      department: toString(department, 200),
    });
    await Activity.create({ user: req.user._id, type: 'create_post', targetType: 'Post', targetId: post._id, metadata: { content, subject, tags } });
    await User.updateOne({ _id: req.user._id }, { $inc: { 'gamification.xp': 10 } });
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name username avatar bio department isVerified role');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.views += 1;
    await post.save();
    const data = post.toObject();
    if (req.user) {
      data.liked = !!(await Like.findOne({ user: req.user._id, targetType: 'Post', targetId: post._id }));
      data.saved = !!(await Bookmark.findOne({ user: req.user._id, targetType: 'Post', targetId: post._id }));
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listPosts = async (req, res) => {
  try {
    const { page, limit, author, subject, type, authorId } = req.query;
    const filter = { status: 'active' };
    if (author) filter.author = toString(author, 100);
    if (authorId) filter.author = toString(authorId, 100);
    if (subject) filter.subject = toString(subject, 200);
    if (type) filter.type = toString(type, 50);
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('author', 'name username avatar bio department isVerified role');
    const list = await Promise.all(
      posts.map(async (p) => {
        const data = p.toObject();
        if (req.user) {
          data.liked = !!(await Like.findOne({ user: req.user._id, targetType: 'Post', targetId: p._id }));
          data.saved = !!(await Bookmark.findOne({ user: req.user._id, targetType: 'Post', targetId: p._id }));
        }
        return data;
      })
    );
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const followingFeed = async (req, res) => {
  try {
    const follows = await require('../models').Follow.find({ follower: req.user._id }).select('following');
    const ids = follows.map((f) => f.following);
    const posts = await Post.find({ author: { $in: ids }, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('author', 'name username avatar bio department isVerified role');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const trendingFeed = async (req, res) => {
  try {
    const days = 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const posts = await Post.find({ status: 'active', createdAt: { $gte: since } })
      .sort({ views: -1, likesCount: -1, sharesCount: -1, commentsCount: -1 })
      .limit(30)
      .populate('author', 'name username avatar bio department isVerified role');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (String(post.author._id || post.author) !== String(req.user._id) && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (req.body.content !== undefined) post.content = toString(req.body.content, 5000);
    if (req.body.subject !== undefined) post.subject = toString(req.body.subject, 200);
    if (req.body.tags !== undefined) {
      post.tags = Array.isArray(req.body.tags)
        ? req.body.tags.map((t) => toString(t, 40)).filter(Boolean).slice(0, 12)
        : [];
    }
    if (req.body.media !== undefined) {
      post.media = Array.isArray(req.body.media)
        ? req.body.media.map((m) => toString(m, 500)).filter((m) => MEDIA_URL_RE.test(m)).slice(0, 6)
        : [];
    }
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (String(post.author._id || post.author) !== String(req.user._id) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    post.status = 'removed';
    await post.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const existing = await Like.findOne({ user: req.user._id, targetType: 'Post', targetId: post._id });
    if (existing) {
      await existing.deleteOne();
      post.likesCount = Math.max(0, post.likesCount - 1);
      await post.save();
      return res.json({ liked: false, likesCount: post.likesCount });
    }
    await Like.create({ user: req.user._id, targetType: 'Post', targetId: post._id });
    post.likesCount += 1;
    await post.save();
    if (String(post.author) !== String(req.user._id)) {
      await Notification.create({
        user: post.author,
        type: 'post_like',
        category: 'Social',
        actor: req.user._id,
        title: 'New like',
        message: `${req.user.name} liked your post`,
        link: `/feed`,
        metadata: { post: post._id },
      });
    }
    res.json({ liked: true, likesCount: post.likesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleSave = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const existing = await Bookmark.findOne({ user: req.user._id, targetType: 'Post', targetId: post._id });
    if (existing) {
      await existing.deleteOne();
      post.savesCount = Math.max(0, post.savesCount - 1);
      await post.save();
      return res.json({ saved: false });
    }
    await Bookmark.create({ user: req.user._id, targetType: 'Post', targetId: post._id });
    post.savesCount += 1;
    await post.save();
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sharePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.sharesCount += 1;
    await post.save();
    await Activity.create({ user: req.user._id, type: 'share', targetType: 'Post', targetId: post._id });
    if (String(post.author) !== String(req.user._id)) {
      await Notification.create({
        user: post.author,
        type: 'share',
        category: 'Social',
        actor: req.user._id,
        title: 'New share',
        message: `${req.user.name} shared your post`,
        link: '/feed',
      });
    }
    res.json({ shared: true, sharesCount: post.sharesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createPost, getPost, listPosts, followingFeed, trendingFeed, updatePost, deletePost, toggleLike, toggleSave, sharePost };
