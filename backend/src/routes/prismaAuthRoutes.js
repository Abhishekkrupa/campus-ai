const express = require('express');

const {
  register,
  login,
  getMe
} = require('../controllers/prismaAuthController');

const prismaProtect = require('../middleware/prismaAuth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', prismaProtect, getMe);

module.exports = router;
