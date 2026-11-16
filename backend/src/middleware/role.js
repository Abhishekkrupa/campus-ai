const { roles } = require('../utils/constants');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (!allowedRoles.includes(req.user.role) && req.user.role !== roles.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
};

const creatorOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authorized' });
  if (req.user.role === 'CREATOR' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'MODERATOR') {
    return next();
  }
  return res.status(403).json({ message: 'Creator account required' });
};

module.exports = { authorize, creatorOnly };
