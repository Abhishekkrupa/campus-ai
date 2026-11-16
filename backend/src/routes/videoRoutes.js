const express = require('express');
const c = require('../controllers/videoController');
const protect = require('../middleware/auth');
const router = express.Router();

router.get('/', protect, c.listVideos);
router.post('/', protect, c.createVideo);
router.get('/:id', protect, c.getVideo);
router.delete('/:id', protect, c.deleteVideo);
router.post('/:id/like', protect, c.toggleLike);
router.post('/:id/save', protect, c.toggleSave);
router.post('/:id/watch-later', protect, c.addWatchLater);
router.post('/:id/history', protect, c.addHistory);

module.exports = router;
