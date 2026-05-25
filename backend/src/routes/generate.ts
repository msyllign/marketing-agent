import { Router } from 'express';
import * as path from 'path';
import { parseSmsTemplate, parsePersonasFile } from '../services/fileService';
import { generateWithCriticLoop } from '../services/claudeService';
import { saveCampaign } from '../services/messageService';
import type { GeneratedMessage } from '../types';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const CONCURRENCY = 2; // conservative to respect API rate limits

router.post('/', async (req, res, next) => {
  try {
    const { campaignId, smsTemplateFile, personasFile } = req.body as {
      campaignId: string;
      smsTemplateFile: string;
      personasFile: string;
    };

    if (!campaignId || !smsTemplateFile || !personasFile) {
      res.status(400).json({
        error: 'campaignId, smsTemplateFile, and personasFile are required',
      });
      return;
    }

    const smsPath = path.join(UPLOADS_DIR, smsTemplateFile);
    const personasPath = path.join(UPLOADS_DIR, personasFile);

    const smsTemplate = await parseSmsTemplate(smsPath);
    const { personas, brief, aiTrainingPack, products } = parsePersonasFile(personasPath);

    if (personas.length === 0) {
      res.status(400).json({ error: 'No personas found in the uploaded file' });
      return;
    }

    console.log(`[Generate] Campaign ${campaignId}: ${personas.length} personas`);
    console.log('[Generate] Running agentic loop for each persona...');

    const messages: GeneratedMessage[] = [];

    // Process in batches to respect API rate limits
    for (let i = 0; i < personas.length; i += CONCURRENCY) {
      const batch = personas.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (persona) => {
          const { message, criticScore, refinementIterations } =
            await generateWithCriticLoop(
              smsTemplate,
              persona,
              brief,
              aiTrainingPack,
              products
            );

          console.log(
            `[Generate] ✓ ${persona.name} — ` +
            `score ${criticScore.score}/10, ${refinementIterations} iteration(s)`
          );

          return {
            personaName: persona.name,
            persona,
            message,
            approved: false,
            criticScore,
            refinementIterations,
          } as GeneratedMessage;
        })
      );
      messages.push(...batchResults);
    }

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

    res.json({ campaignId, messages, count: messages.length });
  } catch (err) {
    next(err);
  }
});

export default router;
