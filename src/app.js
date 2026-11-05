const express = require('express');
const compression = require('compression');
const path = require('path');
const { loadSession, requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errors');
const apiRoutes = require('./routes');

function createApp(){
  const app = express();
  app.set('trust proxy', 1);                 // we sit behind Render's proxy
  app.use(compression());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(loadSession);
  app.use('/api', (req, res, next) => (req.path.startsWith('/auth/') ? next() : requireAuth(req, res, next)));
  app.use('/api', apiRoutes);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };