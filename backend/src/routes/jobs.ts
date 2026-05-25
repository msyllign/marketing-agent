import { Router } from 'express';
import { getJob } from '../services/jobStore';

const router = Router();

/**
 * GET /api/jobs/:jobId
 *
 * Returns current job status + any messages generated so far.
 * Frontend polls this every 3 s while phase === 'generating'.
 */
router.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found or expired' });
    return;
  }
  res.json(job);
});

export default router;
