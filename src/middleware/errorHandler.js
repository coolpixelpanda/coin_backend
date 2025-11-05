const logger = require('../logger');

function notFoundHandler(req, res, next) {
  req?.log?.warn({ path: req.originalUrl }, 'Route not found');
  res.status(404).json({ error: 'Not Found' });
}

function errorHandler(err, req, res, next) {
  if (req?.log) req.log.error({ err }, 'Unhandled error');
  else logger.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
}

module.exports = { notFoundHandler, errorHandler };

