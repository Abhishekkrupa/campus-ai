const express = require('express');
const router = express.Router();
const c = require('../controllers/instituteController');
const protect = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { roles } = require('../utils/constants');

router.use(protect);
router.use(authorize(roles.INSTITUTE));

router.get('/me', c.getProfile);
router.put('/me', c.updateProfile);
router.get('/subjects', c.listSubjects);
router.post('/subjects', c.createSubject);
router.put('/subjects/:id', c.updateSubject);
router.delete('/subjects/:id', c.deleteSubject);

module.exports = router;