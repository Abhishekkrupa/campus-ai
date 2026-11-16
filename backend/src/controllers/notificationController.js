const { prisma, userId: reqUserId } = require('../utils/prisma');
const { toString, toInt } = require('../utils/sanitize');

const listNotifications = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { page, limit, category } = req.query;
    const where = { user: uid };
    const categoryValue = toString(category, 50);
    if (categoryValue && categoryValue !== 'All') where.category = categoryValue;
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 30, max: 100 });
    const notifications = await prisma.notification.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum, take: limitNum,
    });
    const actorIds = [...new Set(notifications.map((n) => n.actor).filter(Boolean))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, username: true, avatar: true } }) : [];
    const amap = Object.fromEntries(actors.map((a) => [a.id, { _id: a.id, name: a.name, username: a.username, avatar: a.avatar }]));
    const out = notifications.map((n) => ({ ...n, _id: n.id, actor: n.actor ? (amap[n.actor] || n.actor) : null }));
    const unread = await prisma.notification.count({ where: { user: uid, read: false } });
    res.json({ notifications: out, unread });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markRead = async (req, res) => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markAllRead = async (req, res) => {
  try {
    const uid = reqUserId(req);
    await prisma.notification.updateMany({ where: { user: uid }, data: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listNotifications, markRead, markAllRead };
