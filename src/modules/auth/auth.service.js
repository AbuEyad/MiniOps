const crypto = require('crypto');
const env = require('../../config/env');
const { db } = require('../../db');

const COOKIE_NAME = 'miniops_session';

// Compare hashes of equal length so timingSafeEqual works and timing leaks nothing.
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const passwordMatches = input => crypto.timingSafeEqual(sha(input), sha(env.adminPassword));

function parseCookies(req){
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(pair => {
    const i = pair.indexOf('=');
    if(i > -1) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1).trim());
  });
  return out;
}

// Render terminates HTTPS in front of your app and tells it through this header.
const isHttps = req => !!(req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https');

function setSessionCookie(req, res, token){
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${isHttps(req) ? '; Secure' : ''}`);
}
function clearSessionCookie(req, res){
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`);
}

async function createSession(){
  const token = crypto.randomBytes(32).toString('hex');
  await db.run(`INSERT INTO sessions (token, expires_at) VALUES ($1, now() + interval '30 days')`, [token]);
  return token;
}
const findSession = token => db.get('SELECT token FROM sessions WHERE token = $1 AND expires_at > now()', [token]);
const deleteSession = token => db.run('DELETE FROM sessions WHERE token = $1', [token]);

module.exports = { COOKIE_NAME, parseCookies, passwordMatches, setSessionCookie, clearSessionCookie, createSession, findSession, deleteSession };