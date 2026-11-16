const express = require('express');
const c = require('../controllers/articleController');
const protect = require('../middleware/auth');
const { creatorOnly } = require('../middleware/role');
const router = express.Router();

router.get('/', protect, c.listArticles);
router.post('/', protect, creatorOnly, c.createArticle);
router.get('/:id', protect, c.getArticle);
router.post('/:id/like', protect, c.toggleLike);

module.exports = router;
