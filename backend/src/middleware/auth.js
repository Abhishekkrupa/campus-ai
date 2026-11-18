const { authenticateRequest } = require('./authenticate');

const protect = async (req, res, next) => {
  // In private mode the centralized guard already loaded and verified the
  // database-backed identity for this request.
  if (req.privateModeAuthenticated && req.user) return next();

  const { user, error } = await authenticateRequest(req);
  if (error) {
    return res.status(error.status).json({ message: error.message });
  }

  req.user = user;
  return next();
};

module.exports = protect;
