const { Conversation, Message, Notification, User } = require('../models');

const getOrCreateConversation = async (req, res) => {
  try {
    const other = await User.findById(req.params.id);
    if (!other) return res.status(404).json({ message: 'User not found' });
    let conv = await Conversation.findOne({
      participants: { $all: [req.user._id, other._id], $size: 2 },
    });
    if (!conv) {
      conv = await Conversation.create({ participants: [req.user._id, other._id], createdBy: req.user._id });
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listConversations = async (req, res) => {
  try {
    const convs = await Conversation.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'name username avatar online lastSeen isVerified role');
    const result = await Promise.all(convs.map(async (c) => {
      const d = c.toObject();
      d.other = d.participants.find((p) => String(p._id) !== String(req.user._id)) || null;
      d.unread = await Message.countDocuments({ conversation: c._id, read: false, sender: { $ne: req.user._id } });
      return d;
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listMessages = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await Message.updateMany({ conversation: conv._id, sender: { $ne: req.user._id } }, { read: true });
    const messages = await Message.find({ conversation: conv._id }).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { content, attachment, attachmentType, resourceId, fileName } = req.body;
    const conv = await Conversation.findById(req.params.id);
    if (!conv || !conv.participants.some((p) => String(p) === String(req.user._id))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const msg = await Message.create({
      conversation: conv._id,
      sender: req.user._id,
      content: content || '',
      attachment,
      attachmentType,
      resourceId,
      fileName,
    });
    conv.lastMessage = content || (fileName ? `Sent ${fileName}` : 'Sent an attachment');
    conv.lastMessageAt = Date.now();
    await conv.save();
    const recipient = conv.participants.find((p) => String(p) !== String(req.user._id));
    if (recipient) {
      await Notification.create({
        user: recipient,
        type: 'message',
        category: 'Social',
        actor: req.user._id,
        title: 'New message',
        message: content ? content.slice(0, 80) : fileName ? `Sent ${fileName}` : 'Sent you an attachment',
        link: '/messages',
      });
    }
    const populated = await Message.findById(msg._id).populate('sender', 'name username avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getOrCreateConversation, listConversations, listMessages, sendMessage };
