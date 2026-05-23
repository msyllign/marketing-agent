import { Router, Request, Response } from 'express';
import { readSmsTemplate, parsePersonasFile } from '../services/fileParser';
import { generatePersonalisedMessage } from '../services/claude';
import { GeneratedMessage } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { campaignId, smsTemplateFile, personasFile } = req.body as {
    campaignId: string;
    smsTemplateFile: string;
    personasFile: string;
  };

  if (!campaignId || !smsTemplateFile || !personasFile) {
    res.status(400).json({ error: 'campaignId, smsTemplateFile, and personasFile are required' });
    return;
  }

  try {
    const template = readSmsTemplate(smsTemplateFile);
    const personas = parsePersonasFile(personasFile);

    if (personas.length === 0) {
      res.status(400).json({ error: 'No personas found in the uploaded file' });
      return;
    }

    // Generate messages concurrently (batched to avoid rate limits)
    const BATCH_SIZE = 5;
    const generated: GeneratedMessage[] = [];

    for (let i = 0; i < personas.length; i += BATCH_SIZE) {
      const batch = personas.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (persona) => {
          const message = await generatePersonalisedMessage(template, persona);
          return {
            personaName: persona.name || `Persona ${i + 1}`,
            persona,
            message,
            approved: false,
          } satisfies GeneratedMessage;
        })
      );
      generated.push(...batchResults);
    }

    res.json({ campaignId, messages: generated });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
