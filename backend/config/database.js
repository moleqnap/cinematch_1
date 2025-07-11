const { Pool } = require('pg');
require('dotenv').config();

// Determine when to enforce SSL. Neon PostgreSQL always requires SSL even from local environments.
// 1) Any DATABASE_URL that points to *.neon.tech
// 2) Production environment
// 3) Explicit override via PG_FORCE_SSL=true
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
const forceSSL = process.env.PG_FORCE_SSL === 'true';

const sslConfig = (isNeon || forceSSL || process.env.NODE_ENV === 'production')
  ? { rejectUnauthorized: false, require: true }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  // Allow overriding pool behaviour through env vars while keeping sensible defaults
  max: parseInt(process.env.PG_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '2000', 10),
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL database');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Execute query with error handling
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query:', { text: text.substring(0, 50) + '...', duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', { text: text.substring(0, 50) + '...', error: error.message });
    throw error;
  }
};

// Get a client from the pool for transactions
const getClient = async () => {
  return await pool.connect();
};

// Graceful shutdown
const shutdown = async () => {
  console.log('Closing database connections...');
  await pool.end();
  console.log('Database connections closed.');
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  shutdown
};