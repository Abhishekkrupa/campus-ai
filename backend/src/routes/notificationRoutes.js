const express = require('express');
const c = require('../controllers/notificationController');
const protect = require('../middleware/auth');
const router = express.Router();

router.get('/', protect, c.listNotifications);
router.put('/read-all', protect, c.markAllRead);
router.put('/:id/read', protect, c.markRead);

module.exports = router;
