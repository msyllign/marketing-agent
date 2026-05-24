import { Router } from 'express';
import * as path from 'path';
import { parseSmsTemplate, parsePersonasFile } from '../services/fileService';
import { generatePersonalizedMessage } from '../services/claudeService';
import { saveCampaign } from '../services/messageService';
import type { GeneratedMessage } from '../types';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

router.post('/', async (req, res, next) => {
  try {
    const { campaignId, smsTemplateFile, personasFile } = req.body as {
      campaignId: string;
      smsTemplateFile: string;
      personasFile: string;
    };

    if (!campaignId || !smsTemplateFile || !personasFile) {
      res.status(400).json({ error: 'campaignId, smsTemplateFile, and personasFile are required' });
      return;
    }

    const smsPath = path.join(UPLOADS_DIR, smsTemplateFile);
    const personasPath = path.join(UPLOADS_DIR, personasFile);

    // Parse uploaded files
    const smsTemplate = await parseSmsTemplate(smsPath);
    const { personas, brief, aiTrainingPack, products } = parsePersonasFile(personasPath);

    if (personas.length === 0) {
      res.status(400).json({ error: 'No personas found in the uploaded file' });
      return;
    }

    console.log(`[Generate] Campaign ${campaignId}: ${personas.length} personas found`);
    console.log('[Generate] Personas:', personas.map((p) => p.name).join(', '));

    // Generate messages concurrently (with a concurrency cap to avoid rate limits)
    const CONCURRENCY = 3;
    const messages: GeneratedMessage[] = [];

    for (let i = 0; i < personas.length; i += CONCURRENCY) {
      const batch = personas.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (persona) => {
          console.log(`[Generate] Generating for: ${persona.name}`);
          const message = await generatePersonalizedMessage(
            smsTemplate,
            persona,
            brief,
            aiTrainingPack,
            products
          );
          return {
            personaName: persona.name,
            persona,
            message,
            approved: false,
          } as GeneratedMessage;
        })
      );
      messages.push(...batchResults);
    }

    // Persist campaign state
    saveCampaign({
      id: campaignId,
      smsTemplate,
      personas,
      brief,
      aiTrainingPack,
      products,
      messages,
      createdAt: new Date().toISOString(),
    });

    res.json({
      campaignId,
      messages,
      count: messages.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
