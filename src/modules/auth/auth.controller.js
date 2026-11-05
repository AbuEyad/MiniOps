const s = require('./auth.service');
const { HttpError } = require('../../utils/http');

exports.login = async (req, res) => {
  const { password } = req.body || {};
  if(!password || !s.passwordMatches(password)) throw new HttpError(401, 'Wrong password.');
  s.setSessionCookie(req, res, await s.createSession());
  res.json({ ok: true });
};

exports.logout = async (req, res) => {
  if(req.session) await s.deleteSession(req.session.token);
  s.clearSessionCookie(req, res);
  res.json({ ok: true });
};

exports.status = (req, res) => res.json({ signedIn: !!req.session });