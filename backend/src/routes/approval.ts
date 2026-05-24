import { Router } from 'express';
import { approveMessage, exportApprovedMessages } from '../services/messageService';

const router = Router();

router.post('/approve', (req, res, next) => {
  try {
    const { campaignId, personaName, message } = req.body as {
      campaignId: string;
      personaName: string;
      message: string;
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
