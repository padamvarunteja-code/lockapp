import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { authRouter } from './server/auth';
import { connectionsRouter } from './server/connections';
import { chatRouter } from './server/chat';
import { vaultRouter } from './server/vault';
import { adminRouter } from './server/admin';
import { setupWebSocket } from './server/ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Accurate client IPs for rate limiting when behind a reverse proxy.
  // Set TRUST_PROXY=1 (or a CIDR) in production; defaults to loopback only.
  const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
  app.set('trust proxy', trustProxy === '1' ? true : trustProxy);

  // Hide framework fingerprint.
  app.disable('x-powered-by');

  // Minimal security headers (no extra dependency).
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Parse JSON payloads (limit 50mb for client-encrypted vault media)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api/connections', connectionsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/vault', vaultRouter);
  app.use('/api/admin', adminRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'OnlyUs Private Communication Server',
      timestamp: Date.now(),
      notificationsDisabled: true, // Architectural compliance flag
    });
  });

  // App distribution info: powers the in-app "Get OnlyUs" download screen.
  const isProdForPaths = process.env.NODE_ENV === 'production';
  const apkPath = isProdForPaths
    ? path.resolve(__dirname, 'dist', 'downloads', 'onlyus.apk')
    : path.resolve(__dirname, 'public', 'downloads', 'onlyus.apk');
  let appVersion = '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
    if (typeof pkg.version === 'string') appVersion = pkg.version;
  } catch { /* keep default */ }

  app.get('/api/app-info', (_req, res) => {
    res.json({
      name: 'OnlyUs',
      version: appVersion,
      apkUrl: '/downloads/onlyus.apk',
      hasApk: fs.existsSync(apkPath),
    });
  });

  // Android APK download. Publish by placing the built APK at
  // public/downloads/onlyus.apk (see .github/workflows/build-apk.yml).
  app.get('/downloads/onlyus.apk', (_req, res) => {
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({ error: 'Android APK not published yet. Please use OnlyUs in the browser.' });
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="onlyus.apk"');
    return res.sendFile(apkPath);
  });

  // Unknown API routes → JSON 404 (prevents SPA fallback swallowing API typos)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Unknown API endpoint' });
  });

  // Attach WebSocket Server for real-time messaging and WebRTC signaling
  setupWebSocket(server);

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1h', etag: true }));
    // Express 5 no longer accepts '*' — use a RegExp fallback for SPA routes.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Centralized JSON error handler (e.g. body-parser entity.too.large)
  // Must be registered after all routes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload too large' });
    }
    console.error('[OnlyUs] Unhandled route error:', err?.message || err);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Internal server error' });
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[OnlyUs] Private Communication Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[OnlyUs] Failed to start server:', err);
  process.exit(1);
});
