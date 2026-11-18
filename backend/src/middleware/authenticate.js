const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/prisma');

const INVALID_TOKEN = { status: 401, message: 'Not authorized, token failed' };

/**
 * Single source of truth for bearer-token authentication.
 * Returns { user } on success or { error: { status, message } } on failure.
 * The loaded user always comes from PostgreSQL, never from token claims.
 */
const authenticateRequest = async (req) => {
  const authorization = req.headers.authorization;

  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return { error: { status: 401, message: 'Not authorized, no token' } };
  }

  const token = authorization.slice(7).trim();
  if (!token) return { error: INVALID_TOKEN };

  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });

    if (!decoded || typeof decoded.id !== 'string') {
      return { error: INVALID_TOKEN };
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return { error: { status: 401, message: 'Not authorized, user not found' } };
    }

    if (user.status === 'suspended') {
      return { error: { status: 403, message: 'Account suspended' } };
    }

    const { password, ...safeUser } = user;
    return { user: { ...safeUser, _id: safeUser.id } };
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      return { error: INVALID_TOKEN };
    }

    console.error('Authentication error:', error);
    return { error: { status: 500, message: 'Authentication service unavailable' } };
  }
};

module.exports = { authenticateRequest };
