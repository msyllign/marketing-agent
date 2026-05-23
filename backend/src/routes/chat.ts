import { Router, Request, Response } from 'express';
import { refineMessageWithFeedback } from '../services/claude';

const router = Router();

router.post('/refine', async (req: Request, res: Response) => {
  const { message, feedback } = req.body as { message: string; feedback: string };

  if (!message || !feedback) {
    res.status(400).json({ error: 'message and feedback are required' });
    return;
  }

  try {
    const refinedMessage = await refineMessageWithFeedback(message, feedback);
    res.json({ refinedMessage });
  } catch (err) {
    console.error('Refine error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
