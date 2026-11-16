const express = require('express');
const c = require('../controllers/userController');
const protect = require('../middleware/auth');
const { creatorOnly } = require('../middleware/role');
const router = express.Router();

router.get('/search', protect, c.searchUsers);
router.get('/by-phone/:phone', protect, c.findByPhone);
router.get('/creators/:username', protect, c.creatorPublic);

router.put('/creator', protect, creatorOnly, c.switchToCreator);
router.put('/creator-profile', protect, creatorOnly, c.updateCreatorProfile);
router.post('/creator/verify', protect, creatorOnly, c.requestVerification);

router.get('/:username', protect, c.getByUsername);
router.get('/:id/profile', protect, c.getProfile);
router.put('/:id', protect, c.updateUser);

router.get('/:id/followers', protect, c.followers);
router.get('/:id/following', protect, c.following);
router.post('/:id/follow', protect, c.follow);
router.delete('/:id/follow', protect, c.unfollow);

router.get('/:id/connections', protect, c.getConnections);
router.post('/:id/connect', protect, c.sendConnection);
router.put('/:id/connect', protect, c.respondConnection);
router.delete('/:id/connect', protect, c.removeConnection);

module.exports = router;
