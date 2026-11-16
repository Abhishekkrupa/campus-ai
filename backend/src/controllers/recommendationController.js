const { User, CreatorProfile, Post, Video, Note, Article, Recommendation, Activity, Follow, Bookmark, Like, Department, Subject } = require('../models');
const ml = require('../services/mlService');
const { escapeRegExp, toString } = require('../utils/sanitize');

// Builds a content-based profile vector from a user's activity signals.
async function buildUserProfile(userId) {
  const activities = await Activity.find({ user: userId }).sort({ createdAt: -1 }).limit(100);
  const likes = await Like.find({ user: userId }).select('targetType targetId');
  const bookmarks = await Bookmark.find({ user: userId }).select('targetType targetId');
  const follows = await Follow.find({ follower: userId }).select('following');

  const parts = [];
  const enrich = async (type, ids) => {
    if (type === 'Note') {
      const docs = await Note.find({ _id: { $in: ids } }).select('title subject tags description');
      docs.forEach((d) => parts.push([d.subject, d.tags.join(' '), d.title, d.description].join(' ')));
    } else if (type === 'Video') {
      const docs = await Video.find({ _id: { $in: ids } }).select('title subject tags');
      docs.forEach((d) => parts.push([d.subject, d.tags.join(' '), d.title].join(' ')));
    } else if (type === 'Post') {
      const docs = await Post.find({ _id: { $in: ids } }).select('content subject tags');
      docs.forEach((d) => parts.push([d.subject, d.tags.join(' '), d.content].join(' ')));
    }
  };

  const likeIds = {};
  likes.forEach((l) => { (likeIds[l.targetType] = likeIds[l.targetType] || []).push(l.targetId); });
  for (const t in likeIds) await enrich(t, likeIds[t]);
  const bmIds = {};
  bookmarks.forEach((b) => { (bmIds[b.targetType] = bmIds[b.targetType] || []).push(b.targetId); });
  for (const t in bmIds) await enrich(t, bmIds[t]);

  activities.forEach((a) => {
    if (a.metadata && a.metadata.subject) parts.push(a.metadata.subject);
    if (a.metadata && a.metadata.tags) parts.push(a.metadata.tags.join(' '));
    parts.push(a.type);
  });
  follows.forEach((f) => parts.push('follow'));

  const user = await User.findById(userId);
  if (user) {
    parts.push(...user.subjects);
    parts.push(...user.skills);
    if (user.department) parts.push(user.department);
  }
  const query = parts.filter(Boolean).join(' ');
  return query || 'student campus learning';
}

const recommendContent = async (req, res) => {
  try {
    const query = await buildUserProfile(req.user._id);
    const [notes, videos, posts] = await Promise.all([
      Note.find({ status: 'active' }).select('title subject tags description views downloads likesCount'),
      Video.find({ status: 'active' }).select('title subject tags views likesCount'),
      Post.find({ status: 'active' }).select('content subject tags likesCount views'),
    ]);
    const noteItems = notes.map((n) => ({ id: n._id, type: 'Note', text: [n.subject, n.tags.join(' '), n.title, n.description].join(' '), payload: n }));
    const videoItems = videos.map((v) => ({ id: v._id, type: 'Video', text: [v.subject, v.tags.join(' '), v.title].join(' '), payload: v }));
    const postItems = posts.map((p) => ({ id: p._id, type: 'Post', text: [p.subject, p.tags.join(' '), p.content].join(' '), payload: p }));

    const notesRec = ml.recommend(query, noteItems, 8);
    const videosRec = ml.recommend(query, videoItems, 8);
    const postsRec = ml.recommend(query, postItems, 8);

    await Recommendation.deleteMany({ user: req.user._id });
    await Recommendation.insertMany([
      ...notesRec.map((r) => ({ user: req.user._id, targetType: 'note', targetId: r.item.id, score: r.score, source: 'tf-idf' })),
      ...videosRec.map((r) => ({ user: req.user._id, targetType: 'video', targetId: r.item.id, score: r.score, source: 'tf-idf' })),
      ...postsRec.map((r) => ({ user: req.user._id, targetType: 'post', targetId: r.item.id, score: r.score, source: 'tf-idf' })),
    ]);

    const serialize = async (recs, series) => {
      return recs.map((r) => {
        const item = r.item.payload;
        return { type: r.item.type, id: item._id, score: r.score, title: item.title, subject: item.subject, tags: item.tags, views: item.views, likes: item.likesCount };
      });
    };
    res.json({
      notes: await serialize(notesRec, notes),
      videos: await serialize(videosRec, videos),
      posts: await serialize(postsRec, posts),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const recommendUsers = async (req, res) => {
  try {
    const query = await buildUserProfile(req.user._id);
    const followed = await Follow.find({ follower: req.user._id }).select('following');
    const followedIds = followed.map((f) => f.following);
    let candidates = await User.find({ _id: { $nin: [...followedIds, req.user._id] }, status: 'active' })
      .select('name username avatar bio department college subjects skills role isVerified')
      .limit(60);
    candidates = candidates.map((u) => {
      const data = u;
      const user = u.toObject();
      return { ...user, text: [user.name, user.bio, user.department, user.college, user.subjects.join(' '), user.skills.join(' ')].join(' ') };
    });
    const result = ml.recommend(query, candidates, 10).map((r) => r.item);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const recommendCreators = async (req, res) => {
  try {
    const query = await buildUserProfile(req.user._id);
    const followed = await Follow.find({ follower: req.user._id }).select('following');
    const followedIds = followed.map((f) => f.following);
    const cps = await CreatorProfile.find().populate('user', 'name username avatar bio department college subjects skills isVerified').limit(60);
    const candidates = cps.filter((cp) => !followedIds.includes(cp.user._id) && String(cp.user._id) !== String(req.user._id));
    const withText = candidates.map((cp) => {
      const u = cp.user.toObject();
      return { id: cp._id, user: cp.user, text: [u.name, u.bio, u.department, u.college, u.subjects.join(' '), u.skills.join(' '), cp.category, cp.expertise.join(' ')].join(' ') };
    });
    const result = ml.recommend(query, withText, 10);
    res.json(result.map((r) => r.item.user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const explore = async (req, res) => {
  try {
    const { subject } = req.query;
    const subjectFilter = subject ? { subject: toString(subject, 200) } : {};
    const [trendingNotes, popularVideos, latestNotes, creators, departments, subjects, trendingPosts] = await Promise.all([
      Note.find({ status: 'active', ...subjectFilter }).sort({ downloads: -1, views: -1 }).limit(8).select('-extractedText').populate('author', 'name username avatar'),
      Video.find({ status: 'active', ...subjectFilter }).sort({ views: -1 }).limit(8).populate('creator', 'name username avatar'),
      Note.find({ status: 'active' }).sort({ createdAt: -1 }).limit(8).select('-extractedText').populate('author', 'name username avatar'),
      CreatorProfile.find().populate('user', 'name username avatar bio department college subjects isVerified').limit(10),
      Department.find(),
      Subject.find().sort({ name: 1 }).limit(20),
      Post.find({ status: 'active', ...subjectFilter }).sort({ views: -1 }).limit(8).populate('author', 'name username avatar'),
    ]);
    res.json({ trendingNotes, popularVideos, latestNotes, creators, departments, subjects, trendingPosts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const query = toString(q, 100);
    if (!query) return res.json({});
    const [people, creators, notes, videos, posts, subjects, departments] = await Promise.all([
      User.find({ $or: [{ name: { $regex: escapeRegExp(query), $options: 'i' } }, { username: { $regex: escapeRegExp(query), $options: 'i' } }] }).limit(6).select('name username avatar bio college department role isVerified'),
      User.find({ accountType: 'CREATOR', $or: [{ name: { $regex: escapeRegExp(query), $options: 'i' } }, { username: { $regex: escapeRegExp(query), $options: 'i' } }, { subjects: { $regex: escapeRegExp(query), $options: 'i' } }] }).limit(6).select('name username avatar bio college department subjects isVerified'),
      Note.find({ $text: { $search: query } }).limit(6).populate('author', 'name username avatar').select('-extractedText'),
      Video.find({ $text: { $search: query } }).limit(6).populate('creator', 'name username avatar'),
      Post.find({ $text: { $search: query } }).limit(6).populate('author', 'name username avatar'),
      Subject.find({ $text: { $search: query } }).limit(6),
      Department.find({ $or: [{ name: { $regex: escapeRegExp(query), $options: 'i' } }, { code: { $regex: escapeRegExp(query), $options: 'i' } }] }).limit(4),
    ]);
    res.json({ people, creators, notes, videos, posts, subjects, departments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { recommendContent, recommendUsers, recommendCreators, explore, globalSearch, buildUserProfile };
