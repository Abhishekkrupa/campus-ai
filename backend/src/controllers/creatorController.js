const { prisma, userId: reqUserId } = require('../utils/prisma');
const { toInt } = require('../utils/sanitize');

async function allContentIds(userId) {
  const [p, v, n, a] = await Promise.all([
    prisma.post.findMany({ where: { author: userId }, select: { id: true } }),
    prisma.video.findMany({ where: { creator: userId }, select: { id: true } }),
    prisma.note.findMany({ where: { author: userId }, select: { id: true } }),
    prisma.article.findMany({ where: { author: userId }, select: { id: true } }),
  ]);
  return [...p, ...v, ...n, ...a].map((x) => x.id);
}

const dashboard = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const cp = await prisma.creatorProfile.findUnique({ where: { user: uid } }).catch(() => null);
    const ids = await allContentIds(uid);
    const [posts, videos, notes, articles, followers, comments] = await Promise.all([
      prisma.post.count({ where: { author: uid, status: 'active' } }),
      prisma.video.count({ where: { creator: uid, status: 'active' } }),
      prisma.note.count({ where: { author: uid, status: 'active' } }),
      prisma.article.count({ where: { author: uid, status: 'published' } }),
      prisma.follow.count({ where: { following: uid } }),
      ids.length ? prisma.comment.count({ where: { targetId: { in: ids } } }) : 0,
    ]);
    res.json({
      profile: cp ? { ...cp, _id: cp.id } : null,
      metrics: { followers, posts, videos, notes, articles, comments, totalContent: posts + videos + notes + articles, views: cp ? cp.views : 0, downloads: cp ? cp.totalDownloads : 0, watchTime: cp ? cp.totalWatchTime : 0 },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function buildSeries(days, collections) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000); buckets[d.toISOString().slice(0, 10)] = 0; }
  collections.forEach((col) => col.forEach((item) => { const key = new Date(item.createdAt).toISOString().slice(0, 10); if (buckets[key] !== undefined) buckets[key] += 1; }));
  return Object.keys(buckets).map((k) => ({ date: k, value: buckets[k] }));
}

const analytics = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { range = '7' } = req.query;
    const days = toInt(range, { min: 1, max: 90, def: 7 });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [posts, videos, notes, followers, reports] = await Promise.all([
      prisma.post.findMany({ where: { author: uid, createdAt: { gte: since } } }),
      prisma.video.findMany({ where: { creator: uid, createdAt: { gte: since } } }),
      prisma.note.findMany({ where: { author: uid, createdAt: { gte: since } } }),
      prisma.follow.count({ where: { following: uid } }),
      prisma.report.count({ where: { targetId: uid } }),
    ]);
    const viewsSeries = buildSeries(days, [posts, videos, notes]);
    const downloadsSeries = buildSeries(days, [notes]);
    const topContent = [
      ...posts.map((p) => ({ type: 'Post', title: p.title || (p.content || '').slice(0, 40), views: p.views, likes: p.likesCount, comments: p.commentsCount, id: p.id })),
      ...videos.map((v) => ({ type: 'Video', title: v.title, views: v.views, likes: v.likesCount, comments: v.commentsCount, id: v.id })),
      ...notes.map((n) => ({ type: 'Note', title: n.title, views: n.views, downloads: n.downloads, id: n.id })),
    ].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
    res.json({ range: days, followers, reports, totals: { posts: posts.length, videos: videos.length, notes: notes.length, views: posts.reduce((s, p) => s + (p.views||0), 0) + videos.reduce((s, v) => s + (v.views||0), 0) + notes.reduce((s, n) => s + (n.views||0), 0), downloads: notes.reduce((s, n) => s + (n.downloads||0), 0), likes: posts.reduce((s, p) => s + (p.likesCount||0), 0) + videos.reduce((s, v) => s + (v.likesCount||0), 0) }, viewsSeries, downloadsSeries, topContent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const content = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const ids = await allContentIds(uid);
    const [posts, videos, notes, articles, comments, playlists] = await Promise.all([
      prisma.post.findMany({ where: { author: uid }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.video.findMany({ where: { creator: uid }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.note.findMany({ where: { author: uid }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.article.findMany({ where: { author: uid }, orderBy: { createdAt: 'desc' }, take: 50 }),
      ids.length ? prisma.comment.findMany({ where: { targetId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
      prisma.playlist.findMany({ where: { owner: uid }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const authorIds = [...new Set(comments.map((c) => c.author).filter(Boolean))];
    const users = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, username: true, avatar: true } }) : [];
    const umap = Object.fromEntries(users.map((u) => [u.id, { _id: u.id, name: u.name, username: u.username, avatar: u.avatar }]));
    res.json({
      posts: posts.map((p)=>({...p,_id:p.id})), videos: videos.map((v)=>({...v,_id:v.id})), notes: notes.map((n)=>{const o={...n,_id:n.id}; delete o.extractedText; return o;}), articles: articles.map((a)=>({...a,_id:a.id})),
      comments: comments.map((c)=>({...c,_id:c.id, author: umap[c.author] || c.author})), playlists: playlists.map((p)=>({...p,_id:p.id}))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const audience = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const follows = await prisma.follow.findMany({ where: { following: uid } });
    const userIds = follows.map((f) => f.follower);
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
    const depts = {}; const interests = {};
    users.forEach((u) => { if (u.department) depts[u.department] = (depts[u.department] || 0) + 1; (u.subjects || []).forEach((s) => { interests[s] = (interests[s] || 0) + 1; }); });
    res.json({ total: users.length, departments: Object.entries(depts).map(([name, value]) => ({ name, value })), interests: Object.entries(interests).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12), recent: users.slice(0, 20).map((u)=>({ _id:u.id,name:u.name,username:u.username,avatar:u.avatar,department:u.department,college:u.college,subjects:u.subjects })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { dashboard, analytics, content, audience };
