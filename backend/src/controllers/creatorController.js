const { User, CreatorProfile, Post, Video, Note, Comment, Article, Follow, Report } = require('../models');
const { toInt } = require('../utils/sanitize');

const dashboard = async (req, res) => {
  try {
    const cp = await CreatorProfile.findOne({ user: req.user._id });
    const [posts, videos, notes, articles, followers, comments] = await Promise.all([
      Post.countDocuments({ author: req.user._id, status: 'active' }),
      Video.countDocuments({ creator: req.user._id, status: 'active' }),
      Note.countDocuments({ author: req.user._id, status: 'active' }),
      Article.countDocuments({ author: req.user._id, status: 'published' }),
      Follow.countDocuments({ following: req.user._id }),
      Comment.countDocuments({ targetId: { $in: await allContentIds(req.user._id) } }),
    ]);
    res.json({
      profile: cp,
      metrics: {
        followers,
        posts,
        videos,
        notes,
        articles,
        comments,
        totalContent: posts + videos + notes + articles,
        views: cp ? cp.views : 0,
        downloads: cp ? cp.totalDownloads : 0,
        watchTime: cp ? cp.totalWatchTime : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

async function allContentIds(userId) {
  const [p, v, n, a] = await Promise.all([
    Post.find({ author: userId }, '_id'),
    Video.find({ creator: userId }, '_id'),
    Note.find({ author: userId }, '_id'),
    Article.find({ author: userId }, '_id'),
  ]);
  return [...p, ...v, ...n, ...a].map((x) => x._id);
}

const analytics = async (req, res) => {
  try {
    const { range = '7' } = req.query;
    const days = toInt(range, { min: 1, max: 90, def: 7 });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [posts, videos, notes, followers, reports] = await Promise.all([
      Post.find({ author: req.user._id, createdAt: { $gte: since } }, 'views likesCount commentsCount sharesCount title createdAt'),
      Video.find({ creator: req.user._id, createdAt: { $gte: since } }, 'views likesCount commentsCount title createdAt'),
      Note.find({ author: req.user._id, createdAt: { $gte: since } }, 'views downloads likesCount title createdAt'),
      Follow.countDocuments({ following: req.user._id }),
      Report.countDocuments({ targetId: req.user._id }),
    ]);

    const viewsSeries = buildSeries(days, [posts, videos, notes], (item, key) => key === 'views');
    const downloadsSeries = buildSeries(days, [notes], (item) => item.downloads);

    const topContent = [
      ...posts.map((p) => ({ type: 'Post', title: p.title || p.content.slice(0, 40), views: p.views, likes: p.likesCount, comments: p.commentsCount, id: p._id })),
      ...videos.map((v) => ({ type: 'Video', title: v.title, views: v.views, likes: v.likesCount, comments: v.commentsCount, id: v._id })),
      ...notes.map((n) => ({ type: 'Note', title: n.title, views: n.views, downloads: n.downloads, id: n._id })),
    ].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);

    res.json({
      range: days,
      followers,
      reports,
      totals: {
        posts: posts.length,
        videos: videos.length,
        notes: notes.length,
        views: posts.reduce((s, p) => s + p.views, 0) + videos.reduce((s, v) => s + v.views, 0) + notes.reduce((s, n) => s + n.views, 0),
        downloads: notes.reduce((s, n) => s + n.downloads, 0),
        likes: posts.reduce((s, p) => s + p.likesCount, 0) + videos.reduce((s, v) => s + v.likesCount, 0),
      },
      viewsSeries,
      downloadsSeries,
      topContent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function buildSeries(days, collections, pick) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  collections.forEach((col) => {
    col.forEach((item) => {
      const key = new Date(item.createdAt).toISOString().slice(0, 10);
      if (buckets[key] !== undefined) buckets[key] += 1;
    });
  });
  return Object.keys(buckets).map((k) => ({ date: k, value: buckets[k] }));
}

const content = async (req, res) => {
  try {
    const [posts, videos, notes, articles, comments, playlists] = await Promise.all([
      Post.find({ author: req.user._id }).sort({ createdAt: -1 }).limit(50),
      Video.find({ creator: req.user._id }).sort({ createdAt: -1 }).limit(50),
      Note.find({ author: req.user._id }).sort({ createdAt: -1 }).limit(50).select('-extractedText'),
      Article.find({ author: req.user._id }).sort({ createdAt: -1 }).limit(50),
      Comment.find({ targetId: { $in: await allContentIds(req.user._id) } }).sort({ createdAt: -1 }).limit(50).populate('author', 'name username avatar'),
      require('../models').Playlist.find({ owner: req.user._id }).sort({ createdAt: -1 }).limit(50),
    ]);
    res.json({ posts, videos, notes, articles, comments, playlists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const audience = async (req, res) => {
  try {
    const followers = await Follow.find({ following: req.user._id }).populate('follower', 'name username avatar department college subjects');
    const depts = {};
    const interests = {};
    followers.forEach((f) => {
      const u = f.follower;
      if (u.department) depts[u.department] = (depts[u.department] || 0) + 1;
      (u.subjects || []).forEach((s) => { interests[s] = (interests[s] || 0) + 1; });
    });
    res.json({
      total: followers.length,
      departments: Object.entries(depts).map(([name, value]) => ({ name, value })),
      interests: Object.entries(interests).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12),
      recent: followers.slice(0, 20).map((f) => f.follower),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { dashboard, analytics, content, audience };
