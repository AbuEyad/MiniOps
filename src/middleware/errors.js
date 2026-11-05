const { HttpError } = require('../utils/http');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next){
  if(res.headersSent) return next(err);
  if(err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if(err && err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: 'Bad request.' });
  console.error('[unhandled]', req.method, req.originalUrl, (err && err.stack) || err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
}

module.exports = { errorHandler };