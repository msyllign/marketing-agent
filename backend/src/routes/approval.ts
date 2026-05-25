import { Router } from 'express';
import { approveMessage, exportApprovedMessages } from '../services/messageService';
import { appendFeedback } from '../services/feedbackStore';
import type { CriticScore } from '../types';

const router = Router();

router.post('/approve', (req, res, next) => {
  try {
    const {
      campaignId,
      personaName,
      message,
      criticScore,
    } = req.body as {
      campaignId: string;
      personaName: string;
      message: string;
      criticScore?: CriticScore;
    };

    if (!campaignId || !personaName || !message) {
      res.status(400).json({ error: 'campaignId, personaName, and message are required' });
      return;
    }

    const campaign = approveMessage(campaignId, personaName, message);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Persist approval to feedback memory
    appendFeedback({
      personaName,
      campaignId,
      timestamp: new Date().toISOString(),
      type: 'approved',
      message,
      criticScore,
    });

    console.log(`[Feedback] Stored approval for "${personaName}" (score: ${criticScore?.score ?? 'N/A'})`);

    res.json({ success: true, campaign });
  } catch (err) {
    next(err);
  }
});

router.get('/export/:campaignId', (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const approved = exportApprovedMessages(campaignId);
    res.json({ campaignId, approvedMessages: approved, count: approved.length });
  } catch (err) {
    next(err);
  }
});

export default router;
