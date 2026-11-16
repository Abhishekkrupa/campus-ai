const { Video, Like, Bookmark, Notification, Activity, User, CreatorProfile, Playlist } = require('../models');
const { toString, toInt } = require('../utils/sanitize');

const createVideo = async (req, res) => {
  try {
    const { title, description, videoUrl, thumbnail, duration, subject, department, tags } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });
    const video = await Video.create({
      creator: req.user._id,
      title,
      description,
      videoUrl,
      thumbnail,
      duration,
      subject,
      department,
      tags,
    });
    await CreatorProfile.findOneAndUpdate({ user: req.user._id }, { $inc: { resourcesCount: 1 } });
    await Activity.create({ user: req.user._id, type: 'create_video', targetType: 'Video', targetId: video._id, metadata: { title, subject, tags } });
    res.status(201).json(video);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getVideo = async (req, res) => {
  try {
    const video = await Video.findOneAndUpdate({ _id: req.params.id, status: 'active' }, { $inc: { views: 1 } }, { new: true }).populate('creator', 'name username avatar bio department isVerified role');
    if (!video) return res.status(404).json({ message: 'Video not found' });
    await CreatorProfile.findOneAndUpdate({ user: video.creator._id }, { $inc: { views: 1 } });
    const data = video.toObject();
    if (req.user) {
      data.liked = !!(await Like.findOne({ user: req.user._id, targetType: 'Video', targetId: video._id }));
      data.saved = !!(await Bookmark.findOne({ user: req.user._id, targetType: 'Video', targetId: video._id }));
    }
    const related = await Video.find({ subject: video.subject, _id: { $ne: video._id }, status: 'active' }).limit(6).populate('creator', 'name username avatar');
    data.related = related;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listVideos = async (req, res) => {
  try {
    const { page, limit, subject, creator, department, search } = req.query;
    const filter = { status: 'active' };
    if (subject) filter.subject = toString(subject, 200);
    if (creator) filter.creator = toString(creator, 100);
    if (department) filter.department = toString(department, 200);
    if (search) filter.$text = { $search: toString(search, 100) };
    const pageNum = toInt(page, { def: 1 });
    const limitNum = toInt(limit, { def: 20, max: 100 });
    const videos = await Video.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('creator', 'name username avatar bio department isVerified role');
    res.json(videos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleLike = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
    const existing = await Like.findOne({ user: req.user._id, targetType: 'Video', targetId: video._id });
    if (existing) {
      await existing.deleteOne();
      video.likesCount = Math.max(0, video.likesCount - 1);
      await video.save();
      return res.json({ liked: false, likesCount: video.likesCount });
    }
    await Like.create({ user: req.user._id, targetType: 'Video', targetId: video._id });
    video.likesCount += 1;
    await video.save();
    res.json({ liked: true, likesCount: video.likesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleSave = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
    const existing = await Bookmark.findOne({ user: req.user._id, targetType: 'Video', targetId: video._id });
    if (existing) {
      await existing.deleteOne();
      video.savesCount = Math.max(0, video.savesCount - 1);
      await video.save();
      return res.json({ saved: false });
    }
    await Bookmark.create({ user: req.user._id, targetType: 'Video', targetId: video._id });
    video.savesCount += 1;
    await video.save();
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
    if (String(video.creator) !== String(req.user._id) && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    video.status = 'removed';
    await video.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Watch later / playlists
const addWatchLater = async (req, res) => {
  try {
    let pl = await Playlist.findOne({ owner: req.user._id, type: 'watch-later' });
    if (!pl) pl = await Playlist.create({ owner: req.user._id, title: 'Watch Later', type: 'watch-later' });
    if (!pl.items.includes(req.params.id)) pl.items.push(req.params.id);
    await pl.save();
    res.json({ added: true, count: pl.items.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addHistory = async (req, res) => {
  try {
    let pl = await Playlist.findOne({ owner: req.user._id, type: 'history' });
    if (!pl) pl = await Playlist.create({ owner: req.user._id, title: 'History', type: 'history' });
    pl.items = pl.items.filter((i) => String(i) !== String(req.params.id));
    pl.items.unshift(req.params.id);
    if (pl.items.length > 100) pl.items = pl.items.slice(0, 100);
    await pl.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createVideo, getVideo, listVideos, toggleLike, toggleSave, deleteVideo, addWatchLater, addHistory };
