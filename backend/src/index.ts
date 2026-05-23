import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import uploadRouter from './routes/upload';
import generateRouter from './routes/generate';
import chatRouter from './routes/chat';
import approvalRouter from './routes/approval';

const app = express();
const PORT = process.env.PORT ?? 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/upload', uploadRouter);
app.use('/api/generate', generateRouter);
app.use('/api/chat', chatRouter);
app.use('/api/approval', approvalRouter);

// ── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅  Marketing Agent API listening on http://localhost:${PORT}`);
  console.log(`    Anthropic key: ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ NOT SET'}`);
});
