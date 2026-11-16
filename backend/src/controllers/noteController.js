const { Note, Like, Bookmark, Activity, CreatorProfile, User, Conversation, Message, Notification } = require('../models');
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

const isOwnUpload = (fileUrl) =>
  typeof fileUrl === 'string' && fileUrl.startsWith('/uploads/');

const normalizePhone = (phone) => String(phone || '').replace(/[\s\-().]/g, '');

const FILE_EXT = { pdf: 'pdf', doc: 'doc', docx: 'docx', ppt: 'ppt', pptx: 'pptx', txt: 'txt', md: 'md', image: 'png', other: 'bin' };
const FILE_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  image: 'image/png',
  other: 'application/octet-stream',
};

const safeFileName = (title, ext) => `${String(title || 'note').replace(/[/\\:]/g, ' ').trim() || 'note'}.${ext}`;

const addStorageUsed = (userId, size) =>
  User.updateOne({ _id: userId }, { $inc: { 'storage.used': size } });

const removeStorageUsed = (userId, size) =>
  User.updateOne({ _id: userId }, [
    { $set: { 'storage.used': { $max: [{ $add: ['$storage.used', -size] }, 0] } } },
  ]);

const applyNoteSideEffects = async (userId, note) => {
  const author = await User.findById(userId);
  if (author && author.creatorId) {
    await CreatorProfile.findOneAndUpdate({ user: userId }, { $inc: { resourcesCount: 1 } });
  }
  await Activity.create({
    user: userId,
    type: 'create_note',
    targetType: 'Note',
    targetId: note._id,
    metadata: { title: note.title, subject: note.subject, tags: note.tags },
  });
};

const getMyStorage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('storage');
    res.json({ storage: user.storage || { used: 0, limit: 0 } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const uploadNote = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ message: 'Title required' });
    }
    const fileType = fileTypeFromMime(req.file.mimetype);
    if (fileType === 'other') {
      return res.status(400).json({ message: 'Unsupported file type. Allowed: PDF, Word, PowerPoint, text, markdown and images.' });
    }
    const user = await User.findById(req.user._id);
    const used = (user.storage && user.storage.used) || 0;
    const limit = (user.storage && user.storage.limit) || 0;
    const size = req.file.size;
    if (limit > 0 && used + size > limit) {
      return res.status(413).json({ message: 'Storage limit reached. Delete some notes to free up space.' });
    }

    const result = await storage.upload(req.file.buffer, {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });

    let extractedText = '';
    try {
      extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (extErr) {
      console.warn('Note text extraction failed:', extErr.message);
    }

    let tags = [];
    if (Array.isArray(req.body.tags)) {
      tags = req.body.tags;
    } else if (typeof req.body.tags === 'string' && req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
      } catch {
        tags = req.body.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
      }
    }

    let note;
    try {
      note = await Note.create({
        author: req.user._id,
        title: String(req.body.title || '').trim(),
        description: String(req.body.description || '').slice(0, 1000),
        subject: String(req.body.subject || ''),
        department: String(req.body.department || ''),
        fileUrl: result.url,
        fileType,
        fileSize: size,
        pageCount: Number(req.body.pageCount) || 0,
        tags,
        extractedText,
      });
      await User.updateOne({ _id: req.user._id }, { $inc: { 'gamification.xp': 20 } });
      await addStorageUsed(req.user._id, size);
      await applyNoteSideEffects(req.user._id, note);
    } catch (err) {
      storage.deleteObject(result.filename);
      throw err;
    }

    res.status(201).json({
      note,
      storage: { used: used + size, limit },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createNote = async (req, res) => {
  try {
    const { title, description, subject, department, fileUrl, fileType, fileSize, pageCount, tags, extractedText } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });

    let resolvedSize = Number(fileSize) || 0;
    if (isOwnUpload(fileUrl)) {
      resolvedSize = storage.getSize(fileUrl) || resolvedSize;
      if (resolvedSize > 0) {
        const user = await User.findById(req.user._id);
        const used = (user.storage && user.storage.used) || 0;
        const limit = (user.storage && user.storage.limit) || 0;
        if (limit > 0 && used + resolvedSize > limit) {
          return res.status(413).json({ message: 'Storage limit reached. Delete some notes to free up space.' });
        }
        await addStorageUsed(req.user._id, resolvedSize);
      }
    }

    const note = await Note.create({
      author: req.user._id,
      title,
      description,
      subject,
      department,
      fileUrl,
      fileType,
      fileSize: resolvedSize,
      pageCount,
      tags,
      extractedText: extractedText ? extractedText.slice(0, 100000) : '',
    });
    const author = await User.findById(req.user._id);
    await User.updateOne({ _id: req.user._id }, { $inc: { 'gamification.xp': 20 } });
    if (author && author.creatorId) {
      await CreatorProfile.findOneAndUpdate({ user: req.user._id }, { $inc: { resourcesCount: 1 } });
    }
    await Activity.create({ user: req.user._id, type: 'create_note', targetType: 'Note', targetId: note._id, metadata: { title, subject, tags } });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getNote = async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate({ _id: req.params.id, status: 'active' }, { $inc: { views: 1 } }, { new: true }).populate('author', 'name username avatar bio department isVerified role');
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const data = note.toObject();
    delete data.extractedText;
    if (req.user) {
      data.liked = !!(await Like.findOne({ user: req.user._id, targetType: 'Note', targetId: note._id }));
      data.saved = !!(await Bookmark.findOne({ user: req.user._id, targetType: 'Note', targetId: note._id }));
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listNotes = async (req, res) => {
  try {
    const { page, limit, subject, author, department, search, sort } = req.query;
    const filter = { status: 'active' };
    if (subject) filter.subject = toString(subject, 200);
    if (author) filter.author = toString(author, 100);
    if (department) filter.department = toString(department, 200);
    if (search) filter.$text = { $search: toString(search, 100) };
    let sortBy = { createdAt: -1 };
    const sortValue = toEnum(sort, ['latest', 'popular', 'trending'], 'latest');
    if (sortValue === 'popular') sortBy = { downloads: -1 };
    if (sortValue === 'trending') sortBy = { views: -1 };
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const notes = await Note.find(filter)
      .sort(sortBy)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('-extractedText')
      .populate('author', 'name username avatar bio department isVerified role');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const downloadNote = async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate({ _id: req.params.id }, { $inc: { downloads: 1 } }, { new: true });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.author) await CreatorProfile.findOneAndUpdate({ user: note.author }, { $inc: { totalDownloads: 1 } });
    await Activity.create({ user: req.user._id, type: 'download', targetType: 'Note', targetId: note._id, metadata: { title: note.title, subject: note.subject } });
    res.json({ url: note.fileUrl, downloads: note.downloads, title: note.title });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const existing = await Like.findOne({ user: req.user._id, targetType: 'Note', targetId: note._id });
    if (existing) {
      await existing.deleteOne();
      note.likesCount = Math.max(0, note.likesCount - 1);
      await note.save();
      return res.json({ liked: false, likesCount: note.likesCount });
    }
    await Like.create({ user: req.user._id, targetType: 'Note', targetId: note._id });
    note.likesCount += 1;
    await note.save();
    res.json({ liked: true, likesCount: note.likesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (String(note.author) !== String(req.user._id) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (note.status === 'removed') {
      return res.json({ success: true });
    }
    note.status = 'removed';
    await note.save();

    if (isOwnUpload(note.fileUrl) && (note.fileSize || 0) > 0) {
      const wasOwned = String(note.author) === String(req.user._id);
      if (wasOwned) {
        await removeStorageUsed(req.user._id, note.fileSize);
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
    const note = await Note.findOne({ _id: req.params.id, status: 'active' });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    const recipient = await User.findOne({ phone });
    if (!recipient) return res.status(404).json({ message: 'No user found with this phone number' });
    if (String(recipient._id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot share a note with yourself' });
    }

    let conv = await Conversation.findOne({
      participants: { $all: [req.user._id, recipient._id], $size: 2 },
    });
    if (!conv) {
      conv = await Conversation.create({
        participants: [req.user._id, recipient._id],
        createdBy: req.user._id,
      });
    }

    const content = `📒 Shared a note: ${note.title}`;
    const ext = FILE_EXT[note.fileType] || 'bin';
    const attach = note.fileUrl
      ? {
          attachment: note.fileUrl,
          attachmentType: FILE_MIME[note.fileType] || 'application/octet-stream',
          fileName: safeFileName(note.title, ext),
          resourceId: note._id,
        }
      : { resourceId: note._id };

    await Message.create({
      conversation: conv._id,
      sender: req.user._id,
      content,
      ...attach,
    });
    conv.lastMessage = content;
    conv.lastMessageAt = Date.now();
    await conv.save();

    await Notification.create({
      user: recipient._id,
      type: 'share',
      category: 'Social',
      actor: req.user._id,
      title: 'Note shared with you',
      message: `${req.user.name} shared the note "${note.title}"`,
      link: `/notes/${note._id}`,
    });
    await Activity.create({
      user: req.user._id,
      type: 'share_note',
      targetType: 'Note',
      targetId: note._id,
      metadata: { title: note.title, phone },
    });

    res.status(201).json({
      success: true,
      conversationId: conv._id,
      recipient: { _id: recipient._id, name: recipient.name, username: recipient.username },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createNote, getNote, listNotes, downloadNote, toggleLike, deleteNote, uploadNote, getMyStorage, shareNoteByPhone };