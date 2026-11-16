const {
  User, CreatorProfile, Post, Video, Note, Comment, Article, Follow, Report,
  Connection, Department, Subject, Category, Notification, Activity, Quiz, Flashcard,
} = require('../models');
const { roles } = require('../utils/constants');
const { escapeRegExp, toString, toInt, toEnum } = require('../utils/sanitize');

const dashboard = async (req, res) => {
  try {
    const [
      totalUsers, activeUsers, creators, resources, videos, posts,
      downloads, aiRequests, reports, departments, subjects,
      userGrowth, creatorGrowth, uploadsToday,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ accountType: 'CREATOR' }),
      Note.countDocuments({ status: 'active' }),
      Video.countDocuments({ status: 'active' }),
      Post.countDocuments({ status: 'active' }),
      Note.countDocuments().then((n) => n), // use downloads aggregate below
      Activity.countDocuments({ type: { $in: ['ai_chat', 'ai_summarize', 'ai_quiz'] } }),
      Report.countDocuments({ status: 'pending' }),
      Department.countDocuments(),
      Subject.countDocuments(),
      growthSeries('user', 14),
      growthSeries('creator', 14),
      Post.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);
    const downloadTotal = await Note.aggregate([{ $group: { _id: null, total: { $sum: '$downloads' } } }]);
    res.json({
      totals: {
        totalUsers, activeUsers, creators, resources, videos, posts,
        downloads: uploadsToday ? (downloadTotal[0]?.total || 0) : (downloadTotal[0]?.total || 0),
        aiRequests, pendingReports: reports, departments, subjects, uploadsToday,
      },
      growth: { userGrowth, creatorGrowth: await growthSeries('creator', 14) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

async function growthSeries(type, days) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  const filter = { type: type === 'creator' ? 'creator_register' : 'user_register' };
  const activities = await Activity.find(filter).select('createdAt');
  activities.forEach((a) => {
    const key = new Date(a.createdAt).toISOString().slice(0, 10);
    if (buckets[key] !== undefined) buckets[key] += 1;
  });
  // cumulative
  let running = 0;
  return Object.keys(buckets).map((k) => {
    running += buckets[k];
    return { date: k, value: running };
  });
}

const listUsers = async (req, res) => {
  try {
    const { page, limit, search, role } = req.query;
    const filter = {};
    if (search) filter.$or = [{ name: { $regex: escapeRegExp(search), $options: 'i' } }, { email: { $regex: escapeRegExp(search), $options: 'i' } }, { username: { $regex: escapeRegExp(search), $options: 'i' } }];
    const roleValue = toEnum(role, Object.values(roles));
    if (roleValue) filter.role = roleValue;
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const users = await User.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum);
    const total = await User.countDocuments(filter);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listCreators = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const filter = {};
    if (search) filter.$or = [{ name: { $regex: escapeRegExp(search), $options: 'i' } }, { username: { $regex: escapeRegExp(search), $options: 'i' } }];
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const creators = await CreatorProfile.find().populate('user').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum);
    const filtered = search
      ? creators.filter((c) => c.user && (c.user.name.toLowerCase().includes(search.toLowerCase()) || c.user.username.includes(search.toLowerCase())))
      : creators;
    res.json({ creators: filtered, total: await CreatorProfile.countDocuments() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listReports = async (req, res) => {
  try {
    const { status } = req.query;
    const statusValue = toEnum(status, ['pending', 'approved', 'dismissed'], 'pending');
    const reports = await Report.find({ status: statusValue })
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name username avatar')
      .populate('handledBy', 'name username')
      .limit(100);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const handleReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote } = req.body;
    const report = await Report.findById(id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (action === 'dismiss') {
      report.status = 'dismissed';
      report.adminNote = adminNote || 'Dismissed';
      report.handledBy = req.user._id;
      await report.save();
      return res.json(report);
    }
    report.status = 'approved';
    report.adminNote = adminNote || 'Content removed';
    report.handledBy = req.user._id;
    await report.save();
    await removeContent(report.targetType, report.targetId);
    const targetUser = await getTargetOwner(report);
    if (targetUser) {
      await Notification.create({
        user: targetUser,
        type: 'admin',
        category: 'System',
        title: 'Content removed',
        message: `Your ${report.targetType.toLowerCase()} was flagged and removed: ${adminNote || 'reason'}`,
      });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

async function removeContent(targetType, targetId) {
  const map = { Post, Video, Note, Article };
  const Model = map[targetType];
  if (Model) await Model.findByIdAndUpdate(targetId, { status: 'removed' });
  else if (targetType === 'Profile') await User.findByIdAndUpdate(targetId, { status: 'suspended' });
  else if (targetType === 'Message') await require('../models').Message.findByIdAndUpdate(targetId, { $set: { content: '[removed]' } });
  else if (targetType === 'Comment') await Comment.findByIdAndUpdate(targetId, { status: 'removed' });
}

async function getTargetOwner(report) {
  const map = { Post: 'author', Video: 'creator', Note: 'author', Article: 'author', Comment: 'author' };
  const Model = map[report.targetType] ? { Post, Video, Note, Article, Comment }[report.targetType] : null;
  if (Model) {
    const doc = await Model.findById(report.targetId);
    return doc ? (doc.author || doc.creator || doc.author) : null;
  }
  if (report.targetType === 'Profile') return report.targetId;
  return null;
}

const moderationList = async (req, res) => {
  try {
    const { type, page, limit } = req.query;
    const typeValue = toEnum(type, ['posts', 'videos', 'notes']);
    let items = [];
    if (typeValue === 'posts') items = await Post.find().sort({ createdAt: -1 }).limit(100).populate('author', 'name username');
    else if (typeValue === 'videos') items = await Video.find().sort({ createdAt: -1 }).limit(100).populate('creator', 'name username');
    else if (typeValue === 'notes') items = await Note.find().sort({ createdAt: -1 }).limit(100).populate('author', 'name username');
    else {
      const [posts, videos, notes, comments] = await Promise.all([
        Post.find().sort({ createdAt: -1 }).limit(50).populate('author', 'name username'),
        Video.find().sort({ createdAt: -1 }).limit(50).populate('creator', 'name username'),
        Note.find().sort({ createdAt: -1 }).limit(50).populate('author', 'name username'),
        Comment.find().sort({ createdAt: -1 }).limit(50).populate('author', 'name username'),
      ]);
      items = { posts, videos, notes, comments };
    }
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const suspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === roles.SUPER_ADMIN) return res.status(400).json({ message: 'Cannot suspend super admin' });
    user.status = user.status === 'suspended' ? 'active' : 'suspended';
    await user.save();
    res.json({ status: user.status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteContent = async (req, res) => {
  try {
    const { type, id } = req.params;
    await removeContent(type, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verificationRequests = async (req, res) => {
  try {
    const cps = await CreatorProfile.find({ 'verificationRequest.requested': true }).populate('user', 'name username email avatar bio college department');
    res.json(cps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const handleVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const cp = await CreatorProfile.findById(id);
    if (!cp) return res.status(404).json({ message: 'Creator profile not found' });
    if (action === 'approve') {
      cp.isVerified = true;
      cp.verificationRequest.requested = false;
      await cp.save();
      await User.updateOne({ _id: cp.user }, { isVerified: true, verificationStatus: 'approved' });
      await Notification.create({ user: cp.user, type: 'admin', category: 'System', title: 'Verification approved', message: 'Your creator account is now verified' });
      return res.json(cp);
    }
    cp.verificationRequest.requested = false;
    await cp.save();
    await User.updateOne({ _id: cp.user }, { verificationStatus: 'rejected' });
    await Notification.create({ user: cp.user, type: 'admin', category: 'System', title: 'Verification declined', message: 'Your verification request was declined. Please contact support.' });
    res.json(cp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const departments = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const d = await Department.create(req.body);
      return res.status(201).json(d);
    }
    const list = await Department.find().sort({ name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const subjects = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const s = await Subject.create(req.body);
      return res.status(201).json(s);
    }
    const list = await Subject.find().sort({ name: 1 }).populate('department', 'name code');
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const systemAnalytics = async (req, res) => {
  try {
    const days = toInt(req.query.range, { min: 1, max: 90, def: 30 });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [users, posts, videos, notes, likes, comments, activities, downloads] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: since } }),
      Post.countDocuments({ createdAt: { $gte: since } }),
      Video.countDocuments({ createdAt: { $gte: since } }),
      Note.countDocuments({ createdAt: { $gte: since } }),
      require('../models').Like.countDocuments({ createdAt: { $gte: since } }),
      Comment.countDocuments({ createdAt: { $gte: since } }),
      Activity.countDocuments({ createdAt: { $gte: since } }),
      Note.countDocuments({ createdAt: { $gte: since } }),
    ]);
    const activitySeries = await dailySeries(Activity, days);
    const userSeries = await dailySeries(User, days);
    res.json({ totals: { users, posts, videos, notes, likes, comments, activities, downloads }, activitySeries, userSeries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

async function dailySeries(Model, days) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  const docs = await Model.find({ createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }).select('createdAt');
  docs.forEach((d) => {
    const key = new Date(d.createdAt).toISOString().slice(0, 10);
    if (buckets[key] !== undefined) buckets[key] += 1;
  });
  return Object.keys(buckets).map((k) => ({ date: k, value: buckets[k] }));
}

const aiUsage = async (req, res) => {
  try {
    const activities = await Activity.find({ type: /^ai_/ }).sort({ createdAt: -1 }).limit(200);
    const byType = {};
    activities.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + 1; });
    const series = await dailySeries(Activity.find({ type: /^ai_/ }).constructor, 14).catch(() => []);
    res.json({ total: activities.length, byType, recent: activities.slice(0, 20).map((a) => ({ type: a.type, createdAt: a.createdAt, user: a.user })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const settings = async (req, res) => {
  try {
    if (req.method === 'PUT') {
      // platform settings stored in env/categories for simplicity
      if (req.body.categories) {
        await Category.deleteMany({});
        await Category.insertMany(req.body.categories);
      }
      return res.json({ success: true, message: 'Settings updated' });
    }
    const categories = await Category.find();
    res.json({ categories, platform: { name: 'CampusAI', maintenance: false, aiEnabled: true } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  dashboard, listUsers, listCreators, listReports, handleReport, moderationList,
  suspendUser, deleteContent, verificationRequests, handleVerification,
  departments, subjects, systemAnalytics, aiUsage, settings,
};
