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