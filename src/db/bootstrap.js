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