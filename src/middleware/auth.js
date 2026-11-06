const { COOKIE_NAME, parseCookies, findSession } = require('../modules/auth/auth.service');

function loadSession(req, res, next){
  (async () => {
    const token = parseCookies(req)[COOKIE_NAME];
    if(token && await findSession(token)) req.session = { token };
    next();
  })().catch(next);
}

function requireAuth(req, res, next){
  if(!req.session) return res.status(401).json({ error: 'Not signed in.' });
  next();
}

module.exports = { loadSession, requireAuth };