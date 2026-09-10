require('dotenv').config();
const app = require('./src/app');
const { verifyDatabaseConnection, pool } = require('./src/config/db');

const PORT = Number(process.env.PORT) || 8801;

async function bootstrap() {
  try {
    // 1. Verify database connection before binding port
    await verifyDatabaseConnection();

    // 2. Start HTTP listener
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // 3. Graceful shutdown handlers
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Draining connections...`);
      server.close(async () => {
        try {
          await pool.promise().end();
          console.log('[Server] Database pool closed cleanly.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error closing pool:', err.message);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Fatal: Application failed to start:', err.message);
    process.exit(1);
  }
}

bootstrap();
