import { app } from './app.js';
import { env } from './config/env.js';
import { checkDbConnection, disconnectPrisma } from './lib/prisma.js';

const PORT = env.PORT || 8080;

const server = app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(`🚀 ClearRoute AI Backend Server started`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🛣️  Corridor: Mumbai JNPT -> Pune Chakan`);
  console.log(`=========================================`);

  const dbStatus = await checkDbConnection();
  if (dbStatus) {
    console.log(`✅ Supabase PostgreSQL connected via Prisma`);
  } else {
    console.log(`ℹ️  Running with in-memory corridor graph demo store`);
  }
});

// Graceful Shutdown
const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await disconnectPrisma();
    console.log('Database connections closed.');
    process.exit(0);
  });

  // Force exit if not terminated within 10s
  setTimeout(() => {
    console.error('Force shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
