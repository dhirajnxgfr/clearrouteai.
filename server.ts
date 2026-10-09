import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { app as backendApp } from './server/src/app.js';
import { checkDbConnection } from './server/src/lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Mount backend API routes under /api
  app.use(backendApp);

  // Vite middlewares for frontend dev or static production files
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌐 ClearRoute AI Full-Stack Server running at http://0.0.0.0:${PORT}`);
    console.log(`📡 Backend API available at http://0.0.0.0:${PORT}/api/v1`);
    await checkDbConnection();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
