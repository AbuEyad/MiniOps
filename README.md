Build MiniOps: a one-page ERP with the AquaOps structure
A step-by-step learning guide. You will build a tiny sales log (one user, one page, two tables) using the same layers as AquaOps: Express backend, plain HTML/JS frontend served by the same server, PostgreSQL on Supabase, deployed on Render. No offline mode.
0. The idea in one minute
Request path: browser (public/) calls fetch on /api/... then app.js, then routes, then controller, then service, then db, then Supabase Postgres.
Rules copied from AquaOps (they are the whole secret of keeping a project tidy):
•routes only declare URLs; controllers handle HTTP in and out; services hold validation and logic; only db/ talks to the database; only config/env.js reads process.env.
•Every write route answers with the fresh data, so the browser never guesses (AquaOps returns the whole state; MiniOps returns the lists).
MiniOps file	AquaOps equivalent
server.js	server.js (start-up and shutdown only)
src/app.js	src/app.js (middleware order matters)
src/config/env.js	src/config/env.js
src/db/index.js, bootstrap.js	src/db/index.js, bootstrap.js
src/middleware/auth.js, errors.js	same names
src/modules/auth, sales	src/modules/* (routes + controller + service)
public/index.html, app.js	public/index.html, app.js
1. Before you start
•Install Node.js 20 or newer (run node -v to check), Git, and VS Code.
•Make a GitHub account (Render deploys from a GitHub repo).
•You will create a Supabase project (step 2) and a Render account (step 12).
2. Create the database on Supabase
1.Sign in at supabase.com and click New project. Choose a name, a region close to you (pick the same region you will choose on Render, for speed), and a database password. Use letters and digits only, so you never have to URL-encode it. Save it somewhere safe.
2.When the project is ready, click Connect at the top and copy the Session pooler connection string. It looks like postgresql://postgres.PROJECTREF:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres. Replace [YOUR-PASSWORD] with your password.
3.Why the pooler? The direct connection host is IPv6-only on the free plan, and many hosts connect over IPv4. The pooler works for both. (Labels in the dashboard move around, so look for Connect and Session pooler.)
4.Free plan facts to remember (check supabase.com/pricing, they change): 500 MB database, 5 GB egress per month, and a free project is paused after about 1 week without activity. A paused project is restored from the dashboard.
You do not need to create tables by hand: the app creates them at start-up (step 6).
3. Create the project skeleton
mkdir miniops
cd miniops
git init
npm init -y
npm install express@4 pg dotenv compression
mkdir -p src/config src/db src/middleware src/utils src/shared src/routes src/modules/auth src/modules/sales public test
Why express@4: its async error handling is simple to learn (step 7 explains the one helper you need).
Open package.json and make sure it contains these two parts (keep the rest):
  "scripts": { "start": "node server.js", "test": "node --test" },
  "engines": { "node": ">=20" }
Create .gitignore with two lines:
node_modules
.env
Create .env (never commit it) and .env.example (commit this one, with empty values):
DATABASE_URL=postgresql://postgres.PROJECTREF:YOURPASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
ADMIN_PASSWORD=choose-a-long-password
PORT=3000
4. Configuration: src/config/env.js
One file reads the environment; everything else imports this object.
require('dotenv').config();

if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if(!process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is required');

let host = '';
try{ host = new URL(process.env.DATABASE_URL).hostname; }catch(e){}
const isLocalDb = ['localhost', '127.0.0.1', '::1'].includes(host);

module.exports = Object.freeze({
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  adminPassword: process.env.ADMIN_PASSWORD,
  ssl: isLocalDb ? false : { rejectUnauthorized: false }   // hosted Postgres needs an encrypted connection
});
5. Database access: src/db/index.js
A pool keeps a few connections open and reuses them. The small db object gives every module the same three helpers (AquaOps does the same with get, all, run).
const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.ssl,
  max: 3,                        // free databases allow few connections
  idleTimeoutMillis: 120000,
  connectionTimeoutMillis: 10000
});
// A connection closed by the database side must not crash the server.
pool.on('error', err => console.error('[pg] idle connection error:', err.message));

const db = {
  async all(sql, params = []){ return (await pool.query(sql, params)).rows; },
  async get(sql, params = []){ return (await pool.query(sql, params)).rows[0]; },
  async run(sql, params = []){ const r = await pool.query(sql, params); return { changes: r.rowCount }; }
};

module.exports = { pool, db };
Always pass values as parameters ($1, $2 ...) and never paste them into the SQL text. That is what stops SQL injection.
6. Tables: src/db/bootstrap.js
Runs on every start; CREATE TABLE IF NOT EXISTS makes it safe to repeat.
const { db } = require('./index');

async function initializeDatabase(){
  await db.run(`CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    product TEXT NOT NULL,
    qty INTEGER NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    total DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.run('CREATE INDEX IF NOT EXISTS sales_date_idx ON sales (date)');
  await db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL)`);
  // Supabase exposes public tables through its own web API. Switching row security on (with no policies)
  // closes that door; this app connects directly as the postgres role, which is not affected.
  await db.run('ALTER TABLE sales ENABLE ROW LEVEL SECURITY');
  await db.run('ALTER TABLE sessions ENABLE ROW LEVEL SECURITY');
}

module.exports = { initializeDatabase };
7. Small shared helpers
src/utils/http.js (Express 4 does not catch errors thrown in async functions, so asyncHandler forwards them):
class HttpError extends Error{
  constructor(status, message){ super(message); this.status = status; }
}
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, asyncHandler };
src/shared/ids.js:
const crypto = require('crypto');
exports.uid = prefix => prefix + '_' + crypto.randomBytes(8).toString('hex');
src/middleware/errors.js (the last middleware: every error leaves in the same { error } shape the browser expects):
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
8. The auth module (one user, cookie session)
Idea: you type the password, the server checks it against ADMIN_PASSWORD, creates a random token, stores it in the sessions table and sends it as an HttpOnly cookie. Every later request carries the cookie.
src/modules/auth/auth.service.js:
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
src/modules/auth/auth.controller.js:
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
src/modules/auth/auth.routes.js:
const router = require('express').Router();
const { asyncHandler } = require('../../utils/http');
const c = require('./auth.controller');

router.post('/login', asyncHandler(c.login));
router.post('/logout', asyncHandler(c.logout));
router.get('/status', c.status);

module.exports = router;
src/middleware/auth.js (loadSession finds who you are; requireAuth refuses strangers):
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
9. The sales module (service, controller, routes)
src/modules/sales/sales.service.js. Validation lives here, and the server always recomputes the total (never trust a number the browser sends):
const { db } = require('../../db');
const { HttpError } = require('../../utils/http');

const round2 = n => Math.round(n * 100) / 100;

function buildSale(body){
  const date = String(body.date || '').trim();
  const product = String(body.product || '').trim();
  const qty = Math.round(Number(body.qty));
  const rate = Number(body.rate);
  if(date.length !== 10 || isNaN(Date.parse(date))) throw new HttpError(400, 'Pick a valid date.');
  if(!product) throw new HttpError(400, 'Enter a product.');
  if(!(qty > 0)) throw new HttpError(400, 'Quantity must be more than zero.');
  if(!(rate >= 0)) throw new HttpError(400, 'Rate cannot be negative.');
  return { date, product, qty, rate, total: round2(qty * rate) };
}

// The 'state' the browser needs. Note the LIMIT and the explicit column list: read only what you show.
async function loadState(){
  const [sales, daily] = await Promise.all([
    db.all('SELECT id, date, product, qty, rate, total FROM sales ORDER BY date DESC, created_at DESC LIMIT 100'),
    db.all('SELECT date, SUM(qty)::int AS qty, SUM(total) AS total FROM sales GROUP BY date ORDER BY date DESC LIMIT 7')
  ]);
  return { sales, daily };
}

module.exports = { buildSale, loadState };
Gotcha worth remembering: SUM of integers and COUNT return a bigint, which node-pg hands you as a string, hence the ::int cast.
src/modules/sales/sales.controller.js:
const { db } = require('../../db');
const { HttpError } = require('../../utils/http');
const { uid } = require('../../shared/ids');
const { buildSale, loadState } = require('./sales.service');

exports.list = async (req, res) => res.json(await loadState());

exports.create = async (req, res) => {
  const s = buildSale(req.body || {});
  await db.run('INSERT INTO sales (id, date, product, qty, rate, total) VALUES ($1,$2,$3,$4,$5,$6)',
    [uid('sale'), s.date, s.product, s.qty, s.rate, s.total]);
  res.json(await loadState());
};

exports.remove = async (req, res) => {
  const r = await db.run('DELETE FROM sales WHERE id = $1', [req.params.id]);
  if(!r.changes) throw new HttpError(404, 'Sale not found.');
  res.json(await loadState());
};
src/modules/sales/sales.routes.js:
const router = require('express').Router();
const { asyncHandler } = require('../../utils/http');
const c = require('./sales.controller');

router.get('/', asyncHandler(c.list));
router.post('/', asyncHandler(c.create));
router.delete('/:id', asyncHandler(c.remove));

module.exports = router;
10. Wire it together
src/routes/index.js:
const router = require('express').Router();

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/sales', require('../modules/sales/sales.routes'));

module.exports = router;
src/app.js. The order is load-bearing: parse the body, serve static files, find the session, guard the API, then the routes, then the error handler last.
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
server.js (start-up and shutdown only):
const env = require('./src/config/env');
const { createApp } = require('./src/app');
const { pool } = require('./src/db');
const { initializeDatabase } = require('./src/db/bootstrap');

async function main(){
  await initializeDatabase();
  const server = createApp().listen(env.port, () => console.log(`MiniOps running on http://localhost:${env.port}`));
  const shutdown = () => server.close(async () => { try{ await pool.end(); }finally{ process.exit(0); } });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(err => { console.error('Failed to start:', err); process.exit(1); });
11. The one-page frontend
public/index.html:
<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1'>
  <title>MiniOps</title>
  <link rel='stylesheet' href='styles.css'>
</head>
<body>
  <section id='login' hidden>
    <h1>MiniOps</h1>
    <form id='loginForm'>
      <input id='password' type='password' placeholder='Password' required>
      <button type='submit'>Sign in</button>
    </form>
    <p id='loginError' class='error'></p>
  </section>

  <main id='app' hidden>
    <header><h1>Sales log</h1><button id='logout'>Sign out</button></header>
    <form id='saleForm'>
      <input id='date' type='date' required>
      <input id='product' placeholder='Product' required>
      <input id='qty' type='number' min='1' placeholder='Qty' required>
      <input id='rate' type='number' min='0' step='0.01' placeholder='Rate' required>
      <button type='submit'>Add</button>
    </form>
    <p id='error' class='error'></p>
    <h2>Last 7 days</h2>
    <table><thead><tr><th>Date</th><th>Qty</th><th>Total</th></tr></thead><tbody id='dailyBody'></tbody></table>
    <h2>Latest sales</h2>
    <table><thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Rate</th><th>Total</th><th></th></tr></thead><tbody id='salesBody'></tbody></table>
  </main>
  <script src='app.js'></script>
</body>
</html>
public/styles.css:
[hidden]{ display: none !important; }
body{ font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
header{ display: flex; justify-content: space-between; align-items: center; }
form{ display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
input, button{ padding: .5rem; font-size: 1rem; }
table{ width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
th, td{ text-align: left; padding: .4rem; border-bottom: 1px solid #ddd; }
.error{ color: #b00020; min-height: 1.2em; }
public/app.js. Rows are built with textContent, never by pasting data into HTML, so a product named with a script tag cannot run (this is called XSS):
const $ = id => document.getElementById(id);

async function api(method, path, body){
  const r = await fetch(path, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if(!r.ok){ const e = new Error(data.error || 'Request failed'); e.status = r.status; throw e; }
  return data;
}

let DB = { sales: [], daily: [] };      // the browser's copy of what the server last sent

function show(signedIn){ $('login').hidden = signedIn; $('app').hidden = !signedIn; }

function addRow(tbody, values){
  const tr = document.createElement('tr');
  values.forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
  tbody.appendChild(tr);
  return tr;
}

function render(){
  const daily = $('dailyBody'); daily.replaceChildren();
  DB.daily.forEach(d => addRow(daily, [d.date, d.qty, d.total.toFixed(2)]));
  const body = $('salesBody'); body.replaceChildren();
  DB.sales.forEach(s => {
    const tr = addRow(body, [s.date, s.product, s.qty, s.rate.toFixed(2), s.total.toFixed(2)]);
    const td = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.onclick = () => { if(confirm('Delete this sale?')) run(() => api('DELETE', '/api/sales/' + s.id)); };
    td.appendChild(btn); tr.appendChild(td);
  });
}

// One place that runs an action, stores the answer, redraws, and shows errors.
async function run(action){
  $('error').textContent = '';
  try{ DB = await action(); render(); }
  catch(err){ if(err.status === 401) show(false); else $('error').textContent = err.message; }
}

async function openApp(){ show(true); await run(() => api('GET', '/api/sales')); }

$('loginForm').onsubmit = async e => {
  e.preventDefault();
  try{ await api('POST', '/api/auth/login', { password: $('password').value }); $('password').value = ''; $('loginError').textContent = ''; await openApp(); }
  catch(err){ $('loginError').textContent = err.message; }
};
$('logout').onclick = async () => { await api('POST', '/api/auth/logout', {}); show(false); };
$('saleForm').onsubmit = e => {
  e.preventDefault();
  run(() => api('POST', '/api/sales', { date: $('date').value, product: $('product').value, qty: $('qty').value, rate: $('rate').value }));
  $('product').value = ''; $('qty').value = '';
};

(async function init(){
  $('date').value = new Date().toISOString().slice(0, 10);
  const s = await api('GET', '/api/auth/status');
  if(s.signedIn) await openApp(); else show(false);
})();
12. Run it, then test it
1.Run npm start. You should see MiniOps running on http://localhost:3000. If it fails with a connection error, re-check DATABASE_URL.
2.Open http://localhost:3000, sign in with ADMIN_PASSWORD, add a sale, reload the page (it should still be there), delete it.
3.In Supabase open Table Editor and look at the sales and sessions tables. Seeing your own rows appear is the moment it clicks.
4.Try the API without a cookie: curl http://localhost:3000/api/sales answers 401 Not signed in. That is requireAuth working.
5.Add a first automated test, test/sales.test.js. Setting dummy variables first lets the file load without a real database:
process.env.DATABASE_URL = 'postgres://x@localhost/x';
process.env.ADMIN_PASSWORD = 'x';
const test = require('node:test');
const assert = require('node:assert');
const { buildSale } = require('../src/modules/sales/sales.service');

test('computes the total from qty and rate', () => {
  const s = buildSale({ date: '2026-11-05', product: 'Water 19L', qty: '3', rate: '0.5' });
  assert.equal(s.total, 1.5);
});

test('rejects a missing product', () => {
  assert.throws(() => buildSale({ date: '2026-11-05', product: ' ', qty: 1, rate: 1 }), /product/i);
});
Run it with npm test.
13. Put it on GitHub
git add .
git commit -m 'MiniOps first version'
Create an empty repository on GitHub (no README), then run the two commands GitHub shows (git remote add origin ... and git push -u origin main, you may need git branch -M main first). Check that .env did not upload.
14. Deploy on Render
1.Create the Render account, click New and Web Service, and connect your GitHub repo.
2.Settings: Runtime Node, Build Command npm install, Start Command npm start, Instance Type Free. Choose a region near your Supabase region.
3.Under Environment add DATABASE_URL (the pooler string), ADMIN_PASSWORD, and NODE_ENV=production. Render does not read your .env file.
4.Deploy, open the onrender.com address, sign in.
5.Free web services are put to sleep after roughly 15 minutes without visitors; the first visit afterwards takes a while to wake. That is normal, not a bug. Every push to GitHub redeploys automatically.
6.If the cookie works locally but not on Render, check that trust proxy is set in app.js and that you open the https address.
15. Keep it free (the lessons from the AquaOps Neon work)
•Read only what you show: explicit columns, a LIMIT, and aggregates in SQL (as loadState does). The AquaOps problem was one SELECT star on a growing table being repeated; MiniOps avoids it from day one.
•Do not poll. A page that asks the server every few seconds keeps the database awake and burns egress.
•Cache what rarely changes: the session lookup runs on every request. Try the exercise below.
•Free databases pause or suspend: Supabase pauses after a week of no use; check the dashboard first if the app cannot connect after a long break.
•Storage and egress limits are per month and per project; look at the usage page once a week for the first month.
16. How to add any feature (the recipe)
1.If it needs data: add the table to bootstrap.js.
2.Put the validation and queries in the module service.
3.Write the controller functions (HTTP in, HTTP out; end with the fresh data).
4.Declare the URLs in the module routes file.
5.Mount the module in routes/index.js.
6.Add the UI in public/ and call it through run().
7.Add a test for the service.
17. Exercises, in order of difficulty
1.Add a products table and module (name, default price) and turn the Product input into a dropdown. Follow the recipe above exactly.
2.Add editing of a sale (PUT /api/sales/:id) that recomputes the total on the server.
3.Add a login throttle: after 5 wrong passwords from one IP, answer 429 for a few minutes (keep the counters in memory).
4.Add an in-memory session cache with a 60 second expiry in findSession, and clear it on logout.
5.Add a date filter and a CSV export.
6.Write a tiny meter in db/index.js that counts rows returned per query and logs a summary every 10 minutes (this is DB_METER in AquaOps).
7.Replace the plain ADMIN_PASSWORD check with a users table and scrypt password hashing.
18. If something breaks
Symptom	Likely cause
DATABASE_URL is required at start	.env missing or in the wrong folder (it must sit next to package.json)
ENETUNREACH or connection timeout	you used the direct host; use the Session pooler string
password authentication failed	wrong password, or special characters not URL-encoded
401 on every request after login	cookie not saved: check you used the same address and, on Render, the https one
Cannot read properties of undefined on req.body	express.json() missing or placed after the routes
Total shows as a string in the browser	a bigint came back from SUM or COUNT; cast with ::int
Works locally, blank page on Render	check the Logs tab; usually a missing environment variable
