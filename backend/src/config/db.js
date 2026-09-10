const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'curenet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

const promisePool = pool.promise();

function verifyDatabaseConnection() {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Fatal: Database connection failed:', err.message);
        return reject(err);
      }
      console.log('Connected to MySQL database successfully');
      connection.release();
      resolve(pool);
    });
  });
}

module.exports = {
  pool,
  promisePool,
  db: pool, // backward compatibility
  verifyDatabaseConnection
};
