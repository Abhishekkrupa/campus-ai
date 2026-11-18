const config = require('../config');
const { authenticateRequest } = require('./authenticate');
const {
  isVerifiedSuperAdmin,
  PRIVATE_MODE_DENIED_CODE,
  PRIVATE_MODE_DENIED_MESSAGE,
  PRIVATE_MODE_REGISTRATION_CODE,
  PRIVATE_MODE_REGISTRATION_MESSAGE,
} = require('../utils/privateMode');

// Endpoints that stay reachable without a session while private mode is on.
const PUBLIC_PATHS = new Set(['/api/health', '/api/config']);
const LOGIN_PATH = '/api/auth/login';
const REGISTER_PATH_PATTERN = /(^|\/)register\/?$/;

const isApiRequest = (path) => path === '/api' || path.startsWith('/api/');

const denyNonAdmin = (res) =>
  res.status(403).json({
    message: PRIVATE_MODE_DENIED_MESSAGE,
    code: PRIVATE_MODE_DENIED_CODE,
  });

/**
 * Centralized gate for every /api request. It is mounted once, before all
 * routers, so it also covers sessions issued before private mode was enabled.
 */
const privateModeGuard = async (req, res, next) => {
  if (!config.adminOnlyMode) return next();

  const { path } = req;

  if (!isApiRequest(path)) return next();
  if (PUBLIC_PATHS.has(path)) return next();

  // Both the active and any legacy registration route are blocked here.
  if (REGISTER_PATH_PATTERN.test(path)) {
    return res.status(403).json({
      message: PRIVATE_MODE_REGISTRATION_MESSAGE,
      code: PRIVATE_MODE_REGISTRATION_CODE,
    });
  }

  // Login stays public; the controller only issues a token to a verified
  // super-admin while private mode is enabled.
  if (req.method === 'POST' && path === LOGIN_PATH) return next();

  const { user, error } = await authenticateRequest(req);
  if (error) {
    return res.status(error.status).json({ message: error.message });
  }

  if (!isVerifiedSuperAdmin(user)) {
    return denyNonAdmin(res);
  }

  // Downstream `protect` middlewares reuse this database-backed identity
  // instead of verifying the same token a second time.
  req.user = user;
  req.privateModeAuthenticated = true;
  return next();
};

module.exports = privateModeGuard;
