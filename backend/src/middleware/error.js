const notFound = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[404] ${req.method} ${req.originalUrl}`);
  }
  res.status(404);
  next(new Error('Not Found'));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  if (err.name === 'CastError') {
    statusCode = 400;
    err.message = 'Invalid identifier';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    statusCode = 401;
    err.message = 'Not authorized, token failed';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
  } else if (err.name === 'MongoServerError' && err.code === 11000) {
    statusCode = 409;
    err.message = 'Resource already exists';
  } else if (err.code === 'P2002') {
    statusCode = 409;
    err.message = 'Resource already exists';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    err.message = 'Not Found';
  }

  const isProd = process.env.NODE_ENV === 'production';
  const safeMessage = isProd && statusCode >= 500 ? 'Internal Server Error' : err.message;

  if (statusCode >= 500) {
    console.error(`[${err.name || 'Error'}]: ${err.message}`, err.stack || '');
  }

  res.status(statusCode).json({ message: safeMessage });
};

module.exports = { notFound, errorHandler };