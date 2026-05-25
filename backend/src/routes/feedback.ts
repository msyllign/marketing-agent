import { Router } from 'express';
import {
  loadFeedbackForPersona,
  appendFeedback,
} from '../services/feedbackStore';
import type { CriticScore } from '../types';

const router = Router();

/** Return the full feedback history for a persona */
router.get('/:personaName', (req, res, next) => {
  try {
    const personaName = decodeURIComponent(req.params.personaName);
    const records = loadFeedbackForPersona(personaName);
    res.json({ personaName, records, count: records.length });
  } catch (err) {
    next(err);
  }
});

/** Record an explicit user rejection (discard) */
router.post('/reject', (req, res, next) => {
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

    appendFeedback({
      personaName,
      campaignId,
      timestamp: new Date().toISOString(),
      type: 'rejected',
      message,
      criticScore,
    });

    console.log(`[Feedback] Stored rejection for "${personaName}"`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
