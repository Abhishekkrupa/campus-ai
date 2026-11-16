const jwt = require('jsonwebtoken');
const config = require('../config');
const { prisma } = require('../utils/prisma');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (typeof decoded.id !== 'string') {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Account suspended' });
    }
    const { password, ...safeUser } = user;
    req.user = { ...safeUser, _id: safeUser.id };
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
    console.error('Auth middleware error:', err);
    return res.status(500).json({ message: 'Authentication service unavailable' });
  }
};

module.exports = protect;
