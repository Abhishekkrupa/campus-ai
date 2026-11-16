const express = require('express');
const c = require('../controllers/recommendationController');
const protect = require('../middleware/auth');
const router = express.Router();

router.use(protect);

router.get('/me', c.recommendContent);
router.get('/users', c.recommendUsers);
router.get('/creators', c.recommendCreators);
router.get('/explore', c.explore);
router.get('/search', c.globalSearch);

module.exports = router;
