const { prisma, createId, userId: reqUserId } = require('../utils/prisma');
const ml = require('../services/mlService');
const { toString } = require('../utils/sanitize');

async function buildUserProfile(userId) {
  const [activities, likes, bookmarks, follows, user] = await Promise.all([
    prisma.activity.findMany({ where: { user: userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.like.findMany({ where: { user: userId } }),
    prisma.bookmark.findMany({ where: { user: userId } }),
    prisma.follow.findMany({ where: { follower: userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  const parts = [];
  const enrich = async (type, ids) => {
    if (!ids.length) return;
    if (type === 'Note') { const docs = await prisma.note.findMany({ where: { id: { in: ids } } }); docs.forEach((d)=>parts.push([d.subject,(d.tags||[]).join(' '),d.title,d.description].join(' '))); }
    else if (type === 'Video') { const docs = await prisma.video.findMany({ where: { id: { in: ids } } }); docs.forEach((d)=>parts.push([d.subject,(d.tags||[]).join(' '),d.title].join(' '))); }
    else if (type === 'Post') { const docs = await prisma.post.findMany({ where: { id: { in: ids } } }); docs.forEach((d)=>parts.push([d.subject,(d.tags||[]).join(' '),d.content].join(' '))); }
  };
  const likeIds = {}; likes.forEach((l)=>{ (likeIds[l.targetType]=likeIds[l.targetType]||[]).push(l.targetId); });
  for (const t in likeIds) await enrich(t, likeIds[t]);
  const bmIds = {}; bookmarks.forEach((b)=>{ (bmIds[b.targetType]=bmIds[b.targetType]||[]).push(b.targetId); });
  for (const t in bmIds) await enrich(t, bmIds[t]);
  activities.forEach((a)=>{ if (a.metadata && a.metadata.subject) parts.push(a.metadata.subject); if (a.metadata && a.metadata.tags) parts.push((a.metadata.tags||[]).join(' ')); parts.push(a.type); });
  if (user) { parts.push(...(user.subjects||[])); parts.push(...(user.skills||[])); if (user.department) parts.push(user.department); }
  return parts.filter(Boolean).join(' ') || 'student campus learning';
}

const recommendContent = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const query = await buildUserProfile(uid);
    const [notes, videos, posts] = await Promise.all([
      prisma.note.findMany({ where: { status: 'active' } }),
      prisma.video.findMany({ where: { status: 'active' } }),
      prisma.post.findMany({ where: { status: 'active' } }),
    ]);
    const noteItems = notes.map((n)=>({ id:n.id, type:'Note', text:[n.subject,(n.tags||[]).join(' '),n.title,n.description].join(' '), payload:n }));
    const videoItems = videos.map((v)=>({ id:v.id, type:'Video', text:[v.subject,(v.tags||[]).join(' '),v.title].join(' '), payload:v }));
    const postItems = posts.map((p)=>({ id:p.id, type:'Post', text:[p.subject,(p.tags||[]).join(' '),p.content].join(' '), payload:p }));
    const notesRec = ml.recommend(query, noteItems, 8);
    const videosRec = ml.recommend(query, videoItems, 8);
    const postsRec = ml.recommend(query, postItems, 8);
    await prisma.recommendation.deleteMany({ where: { user: uid } });
    const recRows = [
      ...notesRec.map((r)=>({ id:createId(), user:uid, targetType:'note', targetId:r.item.id, score:r.score, source:'tf-idf' })),
      ...videosRec.map((r)=>({ id:createId(), user:uid, targetType:'video', targetId:r.item.id, score:r.score, source:'tf-idf' })),
      ...postsRec.map((r)=>({ id:createId(), user:uid, targetType:'post', targetId:r.item.id, score:r.score, source:'tf-idf' })),
    ];
    if (recRows.length) await prisma.recommendation.createMany({ data: recRows });
    const serialize = (recs) => recs.map((r)=>{ const item=r.item.payload; return { type:r.item.type, id:item.id, score:r.score, title:item.title, subject:item.subject, tags:item.tags, views:item.views, likes:item.likesCount }; });
    res.json({ notes: serialize(notesRec), videos: serialize(videosRec), posts: serialize(postsRec) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const recommendUsers = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const query = await buildUserProfile(uid);
    const followed = await prisma.follow.findMany({ where: { follower: uid } });
    const followedIds = followed.map((f)=>f.following);
    const candidates = await prisma.user.findMany({ where: { id: { notIn: [...followedIds, uid] }, status: 'active' }, take: 60 });
    const withText = candidates.map((u)=>({ ...u, _id:u.id, text:[u.name,u.bio,u.department,u.college,(u.subjects||[]).join(' '),(u.skills||[]).join(' ')].join(' ') }));
    const result = ml.recommend(query, withText, 10).map((r)=>{ const {password,text,...rest}=r.item; return { ...rest, _id: rest.id || rest._id }; });
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const recommendCreators = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const query = await buildUserProfile(uid);
    const followed = await prisma.follow.findMany({ where: { follower: uid } });
    const followedIds = followed.map((f)=>f.following);
    const cps = await prisma.creatorProfile.findMany({ take: 60 });
    const filtered = cps.filter((cp)=>!followedIds.includes(cp.user) && String(cp.user)!==String(uid));
    const users = await prisma.user.findMany({ where: { id: { in: filtered.map((c)=>c.user) } } });
    const umap = Object.fromEntries(users.map((u)=>[u.id,u]));
    const withText = filtered.map((cp)=>{ const u=umap[cp.user]; if(!u) return null; return { user:u, text:[u.name,u.bio,u.department,u.college,(u.subjects||[]).join(' '),(u.skills||[]).join(' '),cp.category,(cp.expertise||[]).join(' ')].join(' ') }; }).filter(Boolean);
    const result = ml.recommend(query, withText, 10);
    res.json(result.map((r)=>{ const {password,...u}=r.item.user; return { ...u, _id:u.id }; }));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const explore = async (req, res) => {
  try {
    const { subject } = req.query;
    const subjectFilter = subject ? { subject: toString(subject, 200) } : {};
    const [trendingNotes, popularVideos, latestNotes, creators, departments, subjects, trendingPosts] = await Promise.all([
      prisma.note.findMany({ where: { status: 'active', ...subjectFilter }, orderBy: [{ downloads: 'desc' }, { views: 'desc' }], take: 8 }),
      prisma.video.findMany({ where: { status: 'active', ...subjectFilter }, orderBy: { views: 'desc' }, take: 8 }),
      prisma.note.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'desc' }, take: 8 }),
      prisma.creatorProfile.findMany({ take: 10 }),
      prisma.department.findMany(),
      prisma.subject.findMany({ orderBy: { name: 'asc' }, take: 20 }),
      prisma.post.findMany({ where: { status: 'active', ...subjectFilter }, orderBy: { views: 'desc' }, take: 8 }),
    ]);
    const populate = async (items, key, pick) => {
      const ids = [...new Set(items.map((i)=>i[key]).filter(Boolean))];
      const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
      const umap = Object.fromEntries(users.map((u)=>[u.id, pick(u)]));
      return items.map((i)=>{ const o={...i,_id:i.id}; delete o.extractedText; o[key]=umap[i[key]]||i[key]; return o; });
    };
    const pickUser = (u)=>({ _id:u.id,name:u.name,username:u.username,avatar:u.avatar,bio:u.bio,department:u.department,college:u.college,subjects:u.subjects,isVerified:u.isVerified });
    const pickAuthor = (u)=>({ _id:u.id,name:u.name,username:u.username,avatar:u.avatar });
    const creatorUsers = await prisma.user.findMany({ where: { id: { in: creators.map((c)=>c.user) } } });
    const cumap = Object.fromEntries(creatorUsers.map((u)=>[u.id,pickUser(u)]));
    res.json({
      trendingNotes: await populate(trendingNotes,'author',pickAuthor),
      popularVideos: await populate(popularVideos,'creator',pickAuthor),
      latestNotes: await populate(latestNotes,'author',pickAuthor),
      creators: creators.map((c)=>({ ...c,_id:c.id,user:cumap[c.user]||c.user })),
      departments: departments.map((d)=>({ ...d,_id:d.id })),
      subjects: subjects.map((s)=>({ ...s,_id:s.id })),
      trendingPosts: await populate(trendingPosts,'author',pickAuthor),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const globalSearch = async (req, res) => {
  try {
    const q = toString(req.query.q, 100);
    if (!q) return res.json({});
    const contains = { contains: q, mode: 'insensitive' };
    const [people, creators, notes, videos, posts, subjects, departments] = await Promise.all([
      prisma.user.findMany({ where: { OR: [{ name: contains }, { username: contains }] }, take: 6 }),
      prisma.user.findMany({ where: { accountType: 'CREATOR', OR: [{ name: contains }, { username: contains }, { subjects: { has: q } }] }, take: 6 }),
      prisma.note.findMany({ where: { OR: [{ title: contains }, { subject: contains }] }, take: 6 }),
      prisma.video.findMany({ where: { OR: [{ title: contains }, { subject: contains }] }, take: 6 }),
      prisma.post.findMany({ where: { OR: [{ content: contains }, { subject: contains }] }, take: 6 }),
      prisma.subject.findMany({ where: { OR: [{ name: contains }, { code: contains }] }, take: 6 }),
      prisma.department.findMany({ where: { OR: [{ name: contains }, { code: contains }] }, take: 4 }),
    ]);
    const pick = (u)=>({ _id:u.id,name:u.name,username:u.username,avatar:u.avatar,bio:u.bio,college:u.college,department:u.department,role:u.role,isVerified:u.isVerified,subjects:u.subjects });
    const pickA = (u)=>({ _id:u.id,name:u.name,username:u.username,avatar:u.avatar });
    const pop = async (items,key,picker=pickA)=>{ const ids=[...new Set(items.map((i)=>i[key]).filter(Boolean))]; const us=ids.length?await prisma.user.findMany({where:{id:{in:ids}}}):[]; const m=Object.fromEntries(us.map((u)=>[u.id,picker(u)])); return items.map((i)=>{const o={...i,_id:i.id}; delete o.extractedText; o[key]=m[i[key]]||i[key]; return o;}); };
    res.json({
      people: people.map(pick), creators: creators.map(pick),
      notes: await pop(notes,'author'), videos: await pop(videos,'creator'), posts: await pop(posts,'author'),
      subjects: subjects.map((s)=>({...s,_id:s.id})), departments: departments.map((d)=>({...d,_id:d.id}))
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { recommendContent, recommendUsers, recommendCreators, explore, globalSearch, buildUserProfile };
