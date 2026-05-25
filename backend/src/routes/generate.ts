import { Router } from 'express';
import * as path from 'path';
import { parseSmsTemplate, parsePersonasFile } from '../services/fileService';
import { generateWithCriticLoop } from '../services/claudeService';
import { saveCampaign } from '../services/messageService';
import type { GeneratedMessage } from '../types';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const CONCURRENCY = 1; // sequential — avoids rate-limit cascades and keeps requests short

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

    // Guard: API key must be present
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({
        error:
          'ANTHROPIC_API_KEY is not configured on the server. ' +
          'Please add it as an environment variable in Railway.',
      });
      return;
    }

    const smsPath = path.join(UPLOADS_DIR, smsTemplateFile);
    const personasPath = path.join(UPLOADS_DIR, personasFile);

    const smsTemplate = await parseSmsTemplate(smsPath);
    const { personas, brief, aiTrainingPack, products, sheetNames } =
      parsePersonasFile(personasPath);

    console.log(
      `[Generate] Sheet names found: [${sheetNames.join(', ')}]`
    );
    console.log(
      `[Generate] Parsed: ${personas.length} personas, brief="${brief.title ?? 'n/a'}", ` +
      `products=${Object.keys(products).length}`
    );

    if (personas.length === 0) {
      res.status(400).json({
        error:
          `No personas found in the uploaded file. ` +
          `Sheet names detected: [${sheetNames.join(', ')}]. ` +
          `Expected a sheet with "lifestage" in its name.`,
      });
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
