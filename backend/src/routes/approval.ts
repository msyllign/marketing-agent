import { Router, Request, Response } from 'express';
import { GeneratedMessage } from '../types';

const router = Router();

// In-memory store for approved messages keyed by campaignId
const approvedStore = new Map<string, GeneratedMessage[]>();

router.post('/approve', (req: Request, res: Response) => {
  const { campaignId, personaName, message } = req.body as {
    campaignId: string;
    personaName: string;
    message: string;
  };

  if (!campaignId || !personaName || !message) {
    res.status(400).json({ error: 'campaignId, personaName, and message are required' });
    return;
  }

  const existing = approvedStore.get(campaignId) ?? [];

  // Avoid duplicates – replace if the same persona already has an approved message
  const without = existing.filter((m) => m.personaName !== personaName);
  approvedStore.set(campaignId, [
    ...without,
    { personaName, persona: { name: personaName }, message, approved: true },
  ]);

  res.json({ success: true, campaignId, personaName });
});

router.get('/export/:campaignId', (req: Request, res: Response) => {
  const campaignId = req.params['campaignId'] as string;
  const messages = approvedStore.get(campaignId) ?? [];

  // Return as CSV-friendly structure
  const csvLines = [
    'personaName,message',
    ...messages.map(
      (m) => `"${m.personaName.replace(/"/g, '""')}","${m.message.replace(/"/g, '""')}"`
    ),
  ];

  res.json({
    campaignId,
    count: messages.length,
    messages,
    csv: csvLines.join('\n'),
  });
});

export default router;
