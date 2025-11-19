const logger = require('../logger');

function notFoundHandler(req, res, next) {
  req?.log?.warn({ path: req.originalUrl }, 'Route not found');
  res.status(404).json({ error: 'Not Found' });
}

function errorHandler(err, req, res, next) {
  // Log full error details for debugging
  const errorDetails = {
    message: err?.message,
    name: err?.name,
    code: err?.code,
    stack: err?.stack,
    status: err?.status,
  };
  
  if (req?.log) {
    req.log.error({ err: errorDetails }, 'Unhandled error');
  } else {
    logger.error(errorDetails);
  }
  
  if (res.headersSent) return next(err);
  
  // Don't expose stack traces in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? (err.message || 'Internal Server Error')
    : err.message || 'Internal Server Error';
    
  res.status(err.status || 500).json({ error: errorMessage });
}

module.exports = { notFoundHandler, errorHandler };

