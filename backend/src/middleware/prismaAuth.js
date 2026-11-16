const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/prisma');

const prismaProtect = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Not authorized, no token'
    });
  }

  const token = authorization.slice(7).trim();

  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256']
    });

    if (typeof decoded.id !== 'string') {
      return res.status(401).json({
        message: 'Invalid token'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({
        message: 'Not authorized, user not found'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        message: 'Account suspended'
      });
    }

    const { password, ...safeUser } = user;

    req.user = {
      ...safeUser,
      _id: safeUser.id
    };

    next();
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        message: 'Not authorized, token failed'
      });
    }

    console.error('Prisma auth middleware error:', error);
    return res.status(500).json({
      message: 'Authentication service unavailable'
    });
  }
};

module.exports = prismaProtect;
