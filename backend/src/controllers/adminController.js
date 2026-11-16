const { prisma, createId } = require('../utils/prisma');
const { roles } = require('../utils/constants');
const { escapeRegExp, toString, toInt, toEnum } = require('../utils/sanitize');

async function dailySeriesModel(modelName, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const docs = await prisma[modelName].findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000); buckets[d.toISOString().slice(0, 10)] = 0; }
  docs.forEach((d) => { const key = new Date(d.createdAt).toISOString().slice(0, 10); if (buckets[key] !== undefined) buckets[key] += 1; });
  return Object.keys(buckets).map((k) => ({ date: k, value: buckets[k] }));
}

async function growthSeries(type, days) {
  const filter = { type: type === 'creator' ? 'creator_register' : 'user_register' };
  const activities = await prisma.activity.findMany({ where: filter, select: { createdAt: true } });
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000); buckets[d.toISOString().slice(0, 10)] = 0; }
  activities.forEach((a) => { const key = new Date(a.createdAt).toISOString().slice(0, 10); if (buckets[key] !== undefined) buckets[key] += 1; });
  let running = 0;
  return Object.keys(buckets).map((k) => { running += buckets[k]; return { date: k, value: running }; });
}

const dashboard = async (req, res) => {
  try {
    const [
      totalUsers, activeUsers, creators, resources, videos, posts,
      aiRequests, reports, departments, subjects, uploadsToday, noteAgg,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { accountType: 'CREATOR' } }),
      prisma.note.count({ where: { status: 'active' } }),
      prisma.video.count({ where: { status: 'active' } }),
      prisma.post.count({ where: { status: 'active' } }),
      prisma.activity.count({ where: { type: { in: ['ai_chat', 'ai_summarize', 'ai_quiz'] } } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.department.count(),
      prisma.subject.count(),
      prisma.post.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.note.aggregate({ _sum: { downloads: true } }),
    ]);
    res.json({
      totals: { totalUsers, activeUsers, creators, resources, videos, posts, downloads: noteAgg._sum.downloads || 0, aiRequests, pendingReports: reports, departments, subjects, uploadsToday },
      growth: { userGrowth: await growthSeries('user', 14), creatorGrowth: await growthSeries('creator', 14) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listUsers = async (req, res) => {
  try {
    const { page, limit, search, role } = req.query;
    const where = {};
    if (search) where.OR = [{ name: { contains: String(search), mode: 'insensitive' } }, { email: { contains: String(search), mode: 'insensitive' } }, { username: { contains: String(search), mode: 'insensitive' } }];
    const roleValue = toEnum(role, Object.values(roles));
    if (roleValue) where.role = roleValue;
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * limitNum, take: limitNum }),
      prisma.user.count({ where }),
    ]);
    res.json({ users: users.map((u)=>{const {password,...r}=u; return {...r,_id:r.id};}), total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listCreators = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const creators = await prisma.creatorProfile.findMany({ orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * limitNum, take: limitNum });
    const userIds = creators.map((c) => c.user);
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
    const umap = Object.fromEntries(users.map((u)=>{const {password,...r}=u; return [u.id,{...r,_id:r.id}];}));
    let enriched = creators.map((c)=>({ ...c, _id: c.id, user: umap[c.user] || c.user }));
    if (search) {
      const s = String(search).toLowerCase();
      enriched = enriched.filter((c) => c.user && ((c.user.name||'').toLowerCase().includes(s) || (c.user.username||'').includes(s)));
    }
    res.json({ creators: enriched, total: await prisma.creatorProfile.count() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listReports = async (req, res) => {
  try {
    const { status } = req.query;
    const statusValue = toEnum(status, ['pending', 'approved', 'dismissed'], 'pending');
    const reports = await prisma.report.findMany({ where: { status: statusValue }, orderBy: { createdAt: 'desc' }, take: 100 });
    const ids = [...new Set(reports.flatMap((r)=>[r.reportedBy,r.handledBy].filter(Boolean)))];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id:true,name:true,username:true,avatar:true } }) : [];
    const umap = Object.fromEntries(users.map((u)=>[u.id,{_id:u.id,name:u.name,username:u.username,avatar:u.avatar}]));
    res.json(reports.map((r)=>({ ...r, _id:r.id, reportedBy: umap[r.reportedBy]||r.reportedBy, handledBy: r.handledBy ? (umap[r.handledBy]||r.handledBy) : null })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

async function removeContent(targetType, targetId) {
  const map = { Post: 'post', Video: 'video', Note: 'note', Article: 'article', Comment: 'comment' };
  if (map[targetType]) await prisma[map[targetType]].update({ where: { id: targetId }, data: targetType === 'Comment' ? { status: 'removed' } : { status: 'removed' } }).catch(() => {});
  else if (targetType === 'Profile') await prisma.user.update({ where: { id: targetId }, data: { status: 'suspended' } }).catch(() => {});
  else if (targetType === 'Message') await prisma.message.update({ where: { id: targetId }, data: { content: '[removed]' } }).catch(() => {});
}

async function getTargetOwner(report) {
  const map = { Post: ['post','author'], Video: ['video','creator'], Note: ['note','author'], Article: ['article','author'], Comment: ['comment','author'] };
  const m = map[report.targetType];
  if (m) { const doc = await prisma[m[0]].findUnique({ where: { id: report.targetId } }).catch(()=>null); return doc ? doc[m[1]] : null; }
  if (report.targetType === 'Profile') return report.targetId;
  return null;
}

const handleReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNote } = req.body;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (action === 'dismiss') {
      const updated = await prisma.report.update({ where: { id }, data: { status: 'dismissed', adminNote: adminNote || 'Dismissed', handledBy: req.user.id || req.user._id } });
      return res.json({ ...updated, _id: updated.id });
    }
    const updated = await prisma.report.update({ where: { id }, data: { status: 'approved', adminNote: adminNote || 'Content removed', handledBy: req.user.id || req.user._id } });
    await removeContent(report.targetType, report.targetId);
    const targetUser = await getTargetOwner(report);
    if (targetUser) {
      await prisma.notification.create({ data: { id: createId(), user: targetUser, type: 'admin', category: 'System', title: 'Content removed', message: `Your ${report.targetType.toLowerCase()} was flagged and removed: ${adminNote || 'reason'}` } }).catch(() => {});
    }
    res.json({ ...updated, _id: updated.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const moderationList = async (req, res) => {
  try {
    const { type } = req.query;
    const typeValue = toEnum(type, ['posts', 'videos', 'notes']);
    const mapUser = async (items, key) => {
      const ids = [...new Set(items.map((i)=>i[key]).filter(Boolean))];
      const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id:true,name:true,username:true } }) : [];
      const umap = Object.fromEntries(users.map((u)=>[u.id,{_id:u.id,name:u.name,username:u.username}]));
      return items.map((i)=>({ ...i, _id:i.id, [key]: umap[i[key]] || i[key] }));
    };
    if (typeValue === 'posts') return res.json(await mapUser(await prisma.post.findMany({ orderBy:{createdAt:'desc'}, take:100 }), 'author'));
    if (typeValue === 'videos') return res.json(await mapUser(await prisma.video.findMany({ orderBy:{createdAt:'desc'}, take:100 }), 'creator'));
    if (typeValue === 'notes') return res.json(await mapUser(await prisma.note.findMany({ orderBy:{createdAt:'desc'}, take:100 }), 'author'));
    const [posts, videos, notes, comments] = await Promise.all([
      mapUser(await prisma.post.findMany({ orderBy:{createdAt:'desc'}, take:50 }), 'author'),
      mapUser(await prisma.video.findMany({ orderBy:{createdAt:'desc'}, take:50 }), 'creator'),
      mapUser(await prisma.note.findMany({ orderBy:{createdAt:'desc'}, take:50 }), 'author'),
      mapUser(await prisma.comment.findMany({ orderBy:{createdAt:'desc'}, take:50 }), 'author'),
    ]);
    res.json({ posts, videos, notes, comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const suspendUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === roles.SUPER_ADMIN) return res.status(400).json({ message: 'Cannot suspend super admin' });
    const status = user.status === 'suspended' ? 'active' : 'suspended';
    await prisma.user.update({ where: { id: user.id }, data: { status } });
    res.json({ status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteContent = async (req, res) => {
  try { await removeContent(req.params.type, req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const verificationRequests = async (req, res) => {
  try {
    const cps = await prisma.creatorProfile.findMany();
    const requested = cps.filter((c)=> c.verificationRequest && c.verificationRequest.requested);
    const ids = requested.map((c)=>c.user);
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
    const umap = Object.fromEntries(users.map((u)=>{const {password,...r}=u; return [u.id,{...r,_id:r.id}];}));
    res.json(requested.map((c)=>({ ...c, _id:c.id, user: umap[c.user] || c.user })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const handleVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const cp = await prisma.creatorProfile.findUnique({ where: { id } });
    if (!cp) return res.status(404).json({ message: 'Creator profile not found' });
    if (action === 'approve') {
      const updated = await prisma.creatorProfile.update({ where: { id }, data: { isVerified: true, verificationRequest: { ...(cp.verificationRequest||{}), requested: false } } });
      await prisma.user.update({ where: { id: cp.user }, data: { isVerified: true, verificationStatus: 'approved' } });
      await prisma.notification.create({ data: { id: createId(), user: cp.user, type: 'admin', category: 'System', title: 'Verification approved', message: 'Your creator account is now verified' } }).catch(()=>{});
      return res.json({ ...updated, _id: updated.id });
    }
    const updated = await prisma.creatorProfile.update({ where: { id }, data: { verificationRequest: { ...(cp.verificationRequest||{}), requested: false } } });
    await prisma.user.update({ where: { id: cp.user }, data: { verificationStatus: 'rejected' } });
    await prisma.notification.create({ data: { id: createId(), user: cp.user, type: 'admin', category: 'System', title: 'Verification declined', message: 'Your verification request was declined. Please contact support.' } }).catch(()=>{});
    res.json({ ...updated, _id: updated.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const departments = async (req, res) => {
  try {
    if (req.method === 'POST') { const d = await prisma.department.create({ data: { id: createId(), ...req.body } }); return res.status(201).json({ ...d, _id:d.id }); }
    const list = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    res.json(list.map((d)=>({ ...d, _id:d.id })));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const subjects = async (req, res) => {
  try {
    if (req.method === 'POST') { const s = await prisma.subject.create({ data: { id: createId(), ...req.body } }); return res.status(201).json({ ...s, _id:s.id }); }
    const list = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    // populate department if stored as id
    const depIds = [...new Set(list.map((s)=>s.department).filter(Boolean))];
    const deps = depIds.length ? await prisma.department.findMany({ where: { id: { in: depIds } } }) : [];
    const dmap = Object.fromEntries(deps.map((d)=>[d.id,{_id:d.id,name:d.name,code:d.code}]));
    res.json(list.map((s)=>({ ...s, _id:s.id, department: dmap[s.department] || s.department })));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const systemAnalytics = async (req, res) => {
  try {
    const days = toInt(req.query.range, { min: 1, max: 90, def: 30 });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [users, posts, videos, notes, likes, comments, activities] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.post.count({ where: { createdAt: { gte: since } } }),
      prisma.video.count({ where: { createdAt: { gte: since } } }),
      prisma.note.count({ where: { createdAt: { gte: since } } }),
      prisma.like.count({ where: { createdAt: { gte: since } } }),
      prisma.comment.count({ where: { createdAt: { gte: since } } }),
      prisma.activity.count({ where: { createdAt: { gte: since } } }),
    ]);
    const [activitySeries, userSeries] = await Promise.all([dailySeriesModel('activity', days), dailySeriesModel('user', days)]);
    res.json({ totals: { users, posts, videos, notes, likes, comments, activities, downloads: notes }, activitySeries, userSeries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const aiUsage = async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({ where: { type: { startsWith: 'ai_' } }, orderBy: { createdAt: 'desc' }, take: 200 });
    const byType = {}; activities.forEach((a)=>{ byType[a.type] = (byType[a.type]||0)+1; });
    res.json({ total: activities.length, byType, recent: activities.slice(0,20).map((a)=>({ type:a.type, createdAt:a.createdAt, user:a.user })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const settings = async (req, res) => {
  try {
    if (req.method === 'PUT') {
      if (req.body.categories) {
        await prisma.category.deleteMany({});
        if (Array.isArray(req.body.categories) && req.body.categories.length) {
          await prisma.category.createMany({ data: req.body.categories.map((c)=>({ id: c.id || createId(), name: c.name, type: c.type || 'content', description: c.description || '' })) });
        }
      }
      return res.json({ success: true, message: 'Settings updated' });
    }
    const categories = await prisma.category.findMany();
    res.json({ categories: categories.map((c)=>({...c,_id:c.id})), platform: { name: 'CampusAI', maintenance: false, aiEnabled: true } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { dashboard, listUsers, listCreators, listReports, handleReport, moderationList, suspendUser, deleteContent, verificationRequests, handleVerification, departments, subjects, systemAnalytics, aiUsage, settings };
