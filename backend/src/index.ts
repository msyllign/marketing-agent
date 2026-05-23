import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';

import uploadRouter from './routes/upload';
import generateRouter from './routes/generate';
import chatRouter from './routes/chat';
import approvalRouter from './routes/approval';

const app = express();
const PORT = process.env.PORT ?? 5000;

// ── Serve built React frontend (if present) ──────────────────────────────────
// The frontend build is copied to backend/public during `npm run build:full`
const FRONTEND_BUILD = path.join(__dirname, '..', 'public');
const hasFrontend = fs.existsSync(path.join(FRONTEND_BUILD, 'index.html'));

// ── Middleware ──────────────────────────────────────────────────────────────
// Allow any origin when serving the built frontend (same server);
// restrict to localhost:3000 in dev-only mode.
app.use(cors({ origin: hasFrontend ? '*' : 'http://localhost:3000' }));
app.use(express.json());

if (hasFrontend) {
  app.use(express.static(FRONTEND_BUILD));
}

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/upload', uploadRouter);
app.use('/api/generate', generateRouter);
app.use('/api/chat', chatRouter);
app.use('/api/approval', approvalRouter);

// ── Catch-all: serve React app for non-API routes ────────────────────────────
if (hasFrontend) {
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  });
}

// ── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅  Marketing Agent listening on http://localhost:${PORT}`);
  console.log(`    Frontend: ${hasFrontend ? '✓ served from /public' : '⚠ run frontend dev server separately on :3000'}`);
  console.log(`    Anthropic key: ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ NOT SET — add to backend/.env'}`);
});
