const express = require('express');
const c = require('../controllers/adminController');
const protect = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { roles } = require('../utils/constants');
const router = express.Router();

// All admin routes require SUPER_ADMIN (or MODERATOR for moderation)
router.use(protect);
router.use(authorize(roles.SUPER_ADMIN, roles.MODERATOR));

router.get('/dashboard', c.dashboard);
router.get('/users', c.listUsers);
router.get('/creators', c.listCreators);
router.get('/reports', c.listReports);
router.put('/reports/:id', c.handleReport);
router.get('/moderation', c.moderationList);
router.post('/users/:id/suspend', c.suspendUser);
router.delete('/content/:type/:id', c.deleteContent);
router.get('/verification', c.verificationRequests);
router.put('/verification/:id', c.handleVerification);
router.get('/departments', c.departments);
router.post('/departments', c.departments);
router.get('/subjects', c.subjects);
router.post('/subjects', c.subjects);
router.get('/analytics', c.systemAnalytics);
router.get('/ai-usage', c.aiUsage);
router.get('/settings', c.settings);
router.put('/settings', c.settings);

module.exports = router;
