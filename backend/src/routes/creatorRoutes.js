const express = require('express');
const c = require('../controllers/creatorController');
const protect = require('../middleware/auth');
const { creatorOnly } = require('../middleware/role');
const router = express.Router();

router.get('/dashboard', protect, creatorOnly, c.dashboard);
router.get('/analytics', protect, creatorOnly, c.analytics);
router.get('/content', protect, creatorOnly, c.content);
router.get('/audience', protect, creatorOnly, c.audience);

module.exports = router;
