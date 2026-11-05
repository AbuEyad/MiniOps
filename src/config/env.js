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