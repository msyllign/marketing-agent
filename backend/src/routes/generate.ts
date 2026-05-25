import { Router } from 'express';
import * as path from 'path';
import { parseSmsTemplate, parsePersonasFile } from '../services/fileService';
import { generateWithCriticLoop } from '../services/claudeService';
import { saveCampaign } from '../services/messageService';
import type { GeneratedMessage } from '../types';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const CONCURRENCY = 1; // sequential — keeps request time predictable

router.post('/', async (req, res, next) => {
  try {
    const {
      campaignId,
      smsTemplateFile,
      personasFile,
      segment,
      product,
    } = req.body as {
      campaignId: string;
      smsTemplateFile: string;
      personasFile: string;
      segment: string;
      product: string;
    };

    if (!campaignId || !smsTemplateFile || !personasFile) {
      res.status(400).json({
        error: 'campaignId, smsTemplateFile, and personasFile are required',
      });
      return;
    }

    if (!segment || !product) {
      res.status(400).json({
        error: 'segment and product must be selected before generating',
      });
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({
        error:
          'ANTHROPIC_API_KEY is not configured on the server. ' +
          'Add it as an environment variable in Railway.',
      });
      return;
    }

    const smsPath = path.join(UPLOADS_DIR, smsTemplateFile);
    const personasPath = path.join(UPLOADS_DIR, personasFile);

    const smsTemplate = await parseSmsTemplate(smsPath);
    const { personas, aiTrainingPack, products, sheetNames } =
      parsePersonasFile(personasPath);

    console.log(`[Generate] Sheet names: [${sheetNames.join(', ')}]`);
    console.log(
      `[Generate] Parsed: ${personas.length} personas | ` +
      `segment="${segment}" | product="${product}"`
    );

    if (personas.length === 0) {
      res.status(400).json({
        error:
          `No personas found. Sheet names detected: [${sheetNames.join(', ')}]. ` +
          `Expected a sheet named "Personas Description".`,
      });
      return;
    }

    const messages: GeneratedMessage[] = [];

    for (let i = 0; i < personas.length; i += CONCURRENCY) {
      const batch = personas.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (persona) => {
          const { message, criticScore, refinementIterations } =
            await generateWithCriticLoop(
              smsTemplate,
              persona,
              aiTrainingPack,
              products,
              segment,
              product
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
            segment,
            product,
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
      segment,
      product,
      personas,
      brief: { title: `${product} – ${segment}`, product },
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
