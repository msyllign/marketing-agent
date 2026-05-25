import { Router } from 'express';
import { refineMessage } from '../services/claudeService';
import { appendFeedback } from '../services/feedbackStore';

const router = Router();

router.post('/refine', async (req, res, next) => {
  try {
    const {
      message,
      feedback,
      personaName,
      campaignId,
    } = req.body as {
      message: string;
      feedback: string;
      personaName?: string;
      campaignId?: string;
    };

    if (!message || !feedback) {
      res.status(400).json({ error: 'message and feedback are required' });
      return;
    }

    const refined = await refineMessage(message, feedback);

    // Store the user's refinement request in feedback memory
    if (personaName && campaignId) {
      appendFeedback({
        personaName,
        campaignId,
        timestamp: new Date().toISOString(),
        type: 'user_refinement',
        message,
        userFeedback: feedback,
      });
      console.log(`[Feedback] Stored user refinement for "${personaName}": "${feedback}"`);
    }

    res.json({ refinedMessage: refined });
  } catch (err) {
    next(err);
  }
});

export default router;
