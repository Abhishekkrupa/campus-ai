const express = require('express');
const c = require('../controllers/postController');
const protect = require('../middleware/auth');
const router = express.Router();

router.get('/', protect, c.listPosts);
router.get('/following', protect, c.followingFeed);
router.get('/trending', protect, c.trendingFeed);
router.post('/', protect, c.createPost);
router.get('/:id', protect, c.getPost);
router.put('/:id', protect, c.updatePost);
router.delete('/:id', protect, c.deletePost);
router.post('/:id/like', protect, c.toggleLike);
router.post('/:id/save', protect, c.toggleSave);
router.post('/:id/share', protect, c.sharePost);

module.exports = router;
