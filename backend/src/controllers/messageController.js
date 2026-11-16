const { prisma, createId, userId: reqUserId } = require('../utils/prisma');

const getOrCreateConversation = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const other = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!other) return res.status(404).json({ message: 'User not found' });
    let conv = await prisma.conversation.findFirst({
      where: { participants: { hasEvery: [uid, other.id] } },
    });
    // ensure exactly 2 participants
    if (conv && (conv.participants || []).length !== 2) conv = null;
    if (!conv) {
      conv = await prisma.conversation.create({ data: { id: createId(), participants: [uid, other.id], createdBy: uid } });
    }
    res.json({ ...conv, _id: conv.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listConversations = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const convs = await prisma.conversation.findMany({ where: { participants: { has: uid } }, orderBy: { lastMessageAt: 'desc' } });
    const allIds = [...new Set(convs.flatMap((c) => c.participants || []))];
    const users = allIds.length ? await prisma.user.findMany({ where: { id: { in: allIds } } }) : [];
    const umap = Object.fromEntries(users.map((u) => [u.id, { _id: u.id, name: u.name, username: u.username, avatar: u.avatar, isVerified: u.isVerified, role: u.role }]));
    const result = await Promise.all(convs.map(async (c) => {
      const participants = (c.participants || []).map((p) => umap[p] || { _id: p });
      const other = participants.find((p) => String(p._id) !== String(uid)) || null;
      const unread = await prisma.message.count({ where: { conversation: c.id, read: false, NOT: { sender: uid } } });
      return { ...c, _id: c.id, participants, other, unread };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listMessages = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conv || !(conv.participants || []).some((p) => String(p) === String(uid))) return res.status(403).json({ message: 'Forbidden' });
    await prisma.message.updateMany({ where: { conversation: conv.id, NOT: { sender: uid } }, data: { read: true } });
    const messages = await prisma.message.findMany({ where: { conversation: conv.id }, orderBy: { createdAt: 'asc' }, take: 200 });
    res.json(messages.map((m) => ({ ...m, _id: m.id })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { content, attachment, attachmentType, resourceId, fileName } = req.body;
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conv || !(conv.participants || []).some((p) => String(p) === String(uid))) return res.status(403).json({ message: 'Forbidden' });
    const msg = await prisma.message.create({
      data: { id: createId(), conversation: conv.id, sender: uid, content: content || '', attachment: attachment || '', attachmentType: attachmentType || '', resourceId: resourceId || null, fileName: fileName || '' },
    });
    await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessage: content || (fileName ? `Sent ${fileName}` : 'Sent an attachment'), lastMessageAt: new Date() } });
    const recipient = (conv.participants || []).find((p) => String(p) !== String(uid));
    if (recipient) {
      await prisma.notification.create({ data: { id: createId(), user: recipient, type: 'message', category: 'Social', actor: uid, title: 'New message', message: content ? String(content).slice(0, 80) : fileName ? `Sent ${fileName}` : 'Sent you an attachment', link: '/messages' } }).catch(() => {});
    }
    const sender = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, name: true, username: true, avatar: true } });
    res.status(201).json({ ...msg, _id: msg.id, sender: sender ? { _id: sender.id, name: sender.name, username: sender.username, avatar: sender.avatar } : msg.sender });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getOrCreateConversation, listConversations, listMessages, sendMessage };
