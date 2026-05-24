import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload';
import generateRouter from './routes/generate';
import chatRouter from './routes/chat';
import approvalRouter from './routes/approval';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/upload', uploadRouter);
app.use('/api/generate', generateRouter);
app.use('/api/chat', chatRouter);
app.use('/api/approval', approvalRouter);

// Error handler must be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Server] Marketing Agent backend running on http://localhost:${PORT}`);
  console.log(`[Server] Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ MISSING'}`);
});
