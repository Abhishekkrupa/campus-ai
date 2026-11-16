const { Notification } = require('../models');
const { toString, toInt } = require('../utils/sanitize');

const listNotifications = async (req, res) => {
  try {
    const { page, limit, category } = req.query;
    const filter = { user: req.user._id };
    const categoryValue = toString(category, 50);
    if (categoryValue && categoryValue !== 'All') filter.category = categoryValue;
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 30, max: 100 });
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('actor', 'name username avatar');
    const unread = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ notifications, unread });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listNotifications, markRead, markAllRead };
