import { Router } from 'express';
import { refineMessage } from '../services/claudeService';

const router = Router();

router.post('/refine', async (req, res, next) => {
  try {
    const { message, feedback } = req.body as { message: string; feedback: string };

    if (!message || !feedback) {
      res.status(400).json({ error: 'message and feedback are required' });
      return;
    }

    const refined = await refineMessage(message, feedback);
    res.json({ refinedMessage: refined });
  } catch (err) {
    next(err);
  }
});

export default router;
