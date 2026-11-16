const express = require('express');
const protect = require('../middleware/auth');
const upload = require('../middleware/upload');
const { storage } = require('../services/StorageService');
const { User } = require('../models');
const config = require('../config');
const router = express.Router();

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

const isImage = (file) => file && IMAGE_TYPES.includes(file.mimetype);
const isVideo = (file) => file && VIDEO_TYPES.includes(file.mimetype);

router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await storage.upload(req.file.buffer, {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/post-media', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!isImage(req.file) && !isVideo(req.file)) {
      return res.status(400).json({ message: 'Please upload an image (jpg, png, gif, webp) or video (mp4, webm, mov, avi)' });
    }
    const limit = isVideo(req.file) ? config.upload.maxVideoSize : config.upload.maxImageSize;
    if (req.file.size > limit) {
      return res.status(400).json({ message: `File too large. Max ${isVideo(req.file) ? '200MB' : '8MB'}` });
    }
    const result = await storage.upload(req.file.buffer, {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/avatar', protect, upload.single('file'), async (req, res) => {
  try {
    if (!isImage(req.file)) return res.status(400).json({ message: 'Please upload a valid image (jpg, png, gif, webp, svg)' });
    const result = await storage.upload(req.file.buffer, {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    await User.updateOne({ _id: req.user._id }, { avatar: result.url });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/cover', protect, upload.single('file'), async (req, res) => {
  try {
    if (!isImage(req.file)) return res.status(400).json({ message: 'Please upload a valid image (jpg, png, gif, webp, svg)' });
    const result = await storage.upload(req.file.buffer, {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    await User.updateOne({ _id: req.user._id }, { coverImage: result.url });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
