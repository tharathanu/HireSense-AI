const { env } = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: 'Route not found.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // File too large (multer) and blocked origins (CORS) get friendly messages
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'The file is larger than 5 MB.' });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'This website is not allowed to use the API.' });
  }
  // Prisma "record not found"
  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'Record not found.' });
  }
  const status = err.status || 500;
  if (status >= 500 && env.nodeEnv !== 'test') {
    console.error(err);
  }
  res.status(status).json({
    message: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    fields: err.details || undefined,
  });
}

module.exports = { notFound, errorHandler };
