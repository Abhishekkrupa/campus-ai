const { prisma, createId, userId: reqUserId } = require('../utils/prisma');
const { storage } = require('../services/StorageService');
const { extractTextFromBuffer } = require('../services/documentExtractor');
const { toString, toInt, toEnum } = require('../utils/sanitize');

const NOTE_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/rtf': 'other',
};

const fileTypeFromMime = (mime) => {
  if (NOTE_MIME_TYPES[mime]) return NOTE_MIME_TYPES[mime];
  if (String(mime || '').startsWith('image/')) return 'image';
  return 'other';
};

const isOwnUpload = (fileUrl) => typeof fileUrl === 'string' && fileUrl.startsWith('/uploads/');
const normalizePhone = (phone) => String(phone || '').replace(/[\s\-().]/g, '');
const FILE_EXT = { pdf: 'pdf', doc: 'doc', docx: 'docx', ppt: 'ppt', pptx: 'pptx', txt: 'txt', md: 'md', image: 'png', other: 'bin' };
const FILE_MIME = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', md: 'text/markdown', image: 'image/png', other: 'application/octet-stream' };
const safeFileName = (title, ext) => `${String(title || 'note').replace(/[/\\:]/g, ' ').trim() || 'note'}.${ext}`;

const getStorage = (user) => {
  const s = user.storage || {};
  return { used: Number(s.used || 0), limit: Number(s.limit || 0) };
};

const populateAuthor = async (items) => {
  const arr = Array.isArray(items) ? items : [items];
  const ids = [...new Set(arr.map((n) => n.author).filter(Boolean))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
  const map = Object.fromEntries(users.map((u) => [u.id, { _id: u.id, name: u.name, username: u.username, avatar: u.avatar, bio: u.bio, department: u.department, isVerified: u.isVerified, role: u.role }]));
  const apply = (n) => { const o = { ...n, _id: n.id, author: map[n.author] || n.author }; delete o.extractedText; return o; };
  return Array.isArray(items) ? arr.map(apply) : apply(arr[0]);
};

const addGamificationXp = async (uid, xp) => {
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) return;
  const g = user.gamification || { xp: 0, level: 1, streaks: 0, badges: [] };
  g.xp = (g.xp || 0) + xp;
  await prisma.user.update({ where: { id: uid }, data: { gamification: g } }).catch(() => {});
};

const applyNoteSideEffects = async (userId, note) => {
  const cp = await prisma.creatorProfile.findUnique({ where: { user: userId } }).catch(() => null);
  if (cp) await prisma.creatorProfile.update({ where: { id: cp.id }, data: { resourcesCount: { increment: 1 } } }).catch(() => {});
  await prisma.activity.create({ data: { id: createId(), user: userId, type: 'create_note', targetType: 'Note', targetId: note.id, metadata: { title: note.title, subject: note.subject, tags: note.tags } } }).catch(() => {});
};

const getMyStorage = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: reqUserId(req) } });
    res.json({ storage: user?.storage || { used: 0, limit: 0 } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const uploadNote = async (req, res) => {
  try {
    const uid = reqUserId(req);
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!req.body.title || !String(req.body.title).trim()) return res.status(400).json({ message: 'Title required' });
    const fileType = fileTypeFromMime(req.file.mimetype);
    if (fileType === 'other') return res.status(400).json({ message: 'Unsupported file type. Allowed: PDF, Word, PowerPoint, text, markdown and images.' });
    const user = await prisma.user.findUnique({ where: { id: uid } });
    const { used, limit } = getStorage(user);
    const size = req.file.size;
    if (limit > 0 && used + size > limit) return res.status(413).json({ message: 'Storage limit reached. Delete some notes to free up space.' });

    const result = await storage.upload(req.file.buffer, { mimetype: req.file.mimetype, originalname: req.file.originalname });
    let extractedText = '';
    try { extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname); } catch (extErr) { console.warn('Note text extraction failed:', extErr.message); }
    let tags = [];
    if (Array.isArray(req.body.tags)) tags = req.body.tags;
    else if (typeof req.body.tags === 'string' && req.body.tags) { try { tags = JSON.parse(req.body.tags); } catch { tags = req.body.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean); } }

    let note;
    try {
      note = await prisma.note.create({ data: { id: createId(), author: uid, title: String(req.body.title || '').trim(), description: String(req.body.description || '').slice(0, 1000), subject: String(req.body.subject || ''), department: String(req.body.department || ''), fileUrl: result.url, fileType, fileSize: size, pageCount: Number(req.body.pageCount) || 0, tags, extractedText } });
      await addGamificationXp(uid, 20);
      const ns = getStorage(user);
      await prisma.user.update({ where: { id: uid }, data: { storage: { ...ns, used: used + size, limit } } });
      await applyNoteSideEffects(uid, note);
    } catch (err) {
      storage.deleteObject(result.filename);
      throw err;
    }
    res.status(201).json({ note: { ...note, _id: note.id, extractedText: undefined }, storage: { used: used + size, limit } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createNote = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { title, description, subject, department, fileUrl, fileType, fileSize, pageCount, tags, extractedText } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });
    let resolvedSize = Number(fileSize) || 0;
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (isOwnUpload(fileUrl)) {
      resolvedSize = storage.getSize(fileUrl) || resolvedSize;
      if (resolvedSize > 0) {
        const { used, limit } = getStorage(user);
        if (limit > 0 && used + resolvedSize > limit) return res.status(413).json({ message: 'Storage limit reached. Delete some notes to free up space.' });
        await prisma.user.update({ where: { id: uid }, data: { storage: { used: used + resolvedSize, limit } } });
      }
    }
    const note = await prisma.note.create({ data: { id: createId(), author: uid, title, description: description || '', subject: subject || '', department: department || '', fileUrl: fileUrl || '', fileType: fileType || 'pdf', fileSize: resolvedSize, pageCount: pageCount || 0, tags: tags || [], extractedText: extractedText ? String(extractedText).slice(0, 100000) : '' } });
    await addGamificationXp(uid, 20);
    const cp = await prisma.creatorProfile.findUnique({ where: { user: uid } }).catch(() => null);
    if (cp) await prisma.creatorProfile.update({ where: { id: cp.id }, data: { resourcesCount: { increment: 1 } } }).catch(() => {});
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'create_note', targetType: 'Note', targetId: note.id, metadata: { title, subject, tags } } }).catch(() => {});
    res.status(201).json({ ...note, _id: note.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getNote = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note || note.status !== 'active') return res.status(404).json({ message: 'Note not found' });
    const updated = await prisma.note.update({ where: { id: note.id }, data: { views: { increment: 1 } } });
    let data = await populateAuthor(updated);
    if (uid) {
      data.liked = !!(await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Note', targetId: note.id } } }).catch(() => null));
      data.saved = !!(await prisma.bookmark.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Note', targetId: note.id } } }).catch(() => null));
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listNotes = async (req, res) => {
  try {
    const { page, limit, subject, author, department, search, sort } = req.query;
    const where = { status: 'active' };
    if (subject) where.subject = toString(subject, 200);
    if (author) where.author = toString(author, 100);
    if (department) where.department = toString(department, 200);
    if (search) where.title = { contains: toString(search, 100), mode: 'insensitive' };
    let orderBy = { createdAt: 'desc' };
    const sortValue = toEnum(sort, ['latest', 'popular', 'trending'], 'latest');
    if (sortValue === 'popular') orderBy = { downloads: 'desc' };
    if (sortValue === 'trending') orderBy = { views: 'desc' };
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const notes = await prisma.note.findMany({ where, orderBy, skip: (pageNum - 1) * limitNum, take: limitNum });
    res.json(await populateAuthor(notes));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const downloadNote = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const updated = await prisma.note.update({ where: { id: note.id }, data: { downloads: { increment: 1 } } });
    if (note.author) {
      const cp = await prisma.creatorProfile.findUnique({ where: { user: note.author } }).catch(() => null);
      if (cp) await prisma.creatorProfile.update({ where: { id: cp.id }, data: { totalDownloads: { increment: 1 } } }).catch(() => {});
    }
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'download', targetType: 'Note', targetId: note.id, metadata: { title: note.title, subject: note.subject } } }).catch(() => {});
    res.json({ url: updated.fileUrl, downloads: updated.downloads, title: updated.title });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const existing = await prisma.like.findUnique({ where: { user_targetType_targetId: { user: uid, targetType: 'Note', targetId: note.id } } }).catch(() => null);
    if (existing) {
      await prisma.$transaction([prisma.like.delete({ where: { id: existing.id } }), prisma.note.update({ where: { id: note.id }, data: { likesCount: { decrement: 1 } } })]);
      const n = await prisma.note.findUnique({ where: { id: note.id } });
      return res.json({ liked: false, likesCount: Math.max(0, n.likesCount) });
    }
    await prisma.$transaction([prisma.like.create({ data: { id: createId(), user: uid, targetType: 'Note', targetId: note.id } }), prisma.note.update({ where: { id: note.id }, data: { likesCount: { increment: 1 } } })]);
    const n = await prisma.note.findUnique({ where: { id: note.id } });
    res.json({ liked: true, likesCount: n.likesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (String(note.author) !== String(uid) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') return res.status(403).json({ message: 'Forbidden' });
    if (note.status === 'removed') return res.json({ success: true });
    await prisma.note.update({ where: { id: note.id }, data: { status: 'removed' } });
    if (isOwnUpload(note.fileUrl) && (note.fileSize || 0) > 0) {
      if (String(note.author) === String(uid)) {
        const user = await prisma.user.findUnique({ where: { id: uid } });
        const { used, limit } = getStorage(user);
        await prisma.user.update({ where: { id: uid }, data: { storage: { used: Math.max(0, used - note.fileSize), limit } } }).catch(() => {});
      }
      storage.deleteObject(note.fileUrl);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const shareNoteByPhone = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note || note.status !== 'active') return res.status(404).json({ message: 'Note not found' });
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ message: 'Phone number required' });
    const recipient = await prisma.user.findFirst({ where: { phone } });
    if (!recipient) return res.status(404).json({ message: 'No user found with this phone number' });
    if (String(recipient.id) === String(uid)) return res.status(400).json({ message: 'You cannot share a note with yourself' });

    let conv = await prisma.conversation.findFirst({ where: { participants: { hasEvery: [uid, recipient.id] } } });
    if (conv && (conv.participants || []).length !== 2) conv = null;
    if (!conv) conv = await prisma.conversation.create({ data: { id: createId(), participants: [uid, recipient.id], createdBy: uid } });

    const content = `📒 Shared a note: ${note.title}`;
    const ext = FILE_EXT[note.fileType] || 'bin';
    await prisma.message.create({ data: { id: createId(), conversation: conv.id, sender: uid, content, attachment: note.fileUrl || '', attachmentType: FILE_MIME[note.fileType] || 'application/octet-stream', fileName: safeFileName(note.title, ext), resourceId: note.id } });
    await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessage: content, lastMessageAt: new Date() } });
    await prisma.notification.create({ data: { id: createId(), user: recipient.id, type: 'share', category: 'Social', actor: uid, title: 'Note shared with you', message: `${req.user.name} shared the note "${note.title}"`, link: `/notes/${note.id}` } }).catch(() => {});
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'share_note', targetType: 'Note', targetId: note.id, metadata: { title: note.title, phone } } }).catch(() => {});
    res.status(201).json({ success: true, conversationId: conv.id, recipient: { _id: recipient.id, name: recipient.name, username: recipient.username } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createNote, getNote, listNotes, downloadNote, toggleLike, deleteNote, uploadNote, getMyStorage, shareNoteByPhone };
