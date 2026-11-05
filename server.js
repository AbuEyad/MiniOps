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