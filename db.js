const { Pool } = require('pg');

// Create a connection pool
const pool = new Pool({
  user: 'postgres',          // your DB user
  host: 'localhost',         // DB host
  database: 'chaher',        // your DB name
  password: '0405', // your DB password
  port: 5432                 // default Postgres port
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('PostgreSQL connected ✅');
  release();
});

module.exports = pool;
