const express = require('express');
const c = require('../controllers/messageController');
const protect = require('../middleware/auth');
const router = express.Router();

router.get('/', protect, c.listConversations);
router.get('/:id', protect, c.listMessages);
router.post('/with/:id', protect, c.getOrCreateConversation);
router.post('/:id', protect, c.sendMessage);

module.exports = router;
