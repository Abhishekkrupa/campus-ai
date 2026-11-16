const express = require('express');
const c = require('../controllers/commentController');
const protect = require('../middleware/auth');
const router = express.Router();

router.get('/', protect, c.listComments);
router.post('/', protect, c.addComment);
router.delete('/:id', protect, c.deleteComment);

module.exports = router;
