import { Router } from 'express';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { parseSmsTemplate, parsePersonasFile } from '../services/fileService';
import { generateWithCriticLoop } from '../services/claudeService';
import { saveCampaign, findByCacheKey } from '../services/messageService';
import { createJob, addJobMessage, completeJob, failJob } from '../services/jobStore';
import type { GeneratedMessage } from '../types';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hash (first 16 hex chars) of a file's content. */
function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

/**
 * Stable cache key for a generation request.
 * Changes whenever the segment, product, or either uploaded file changes.
 */
function buildCacheKey(
  segment: string,
  product: string,
  personasPath: string,
  smsPath: string
): string {
  const ph = hashFile(personasPath);
  const sh = hashFile(smsPath);
  return `${segment}__${product}__${ph}__${sh}`;
}

// ── Route ────────────────────────────────────────────────────────────────────

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
      res.status(400).json({ error: 'campaignId, smsTemplateFile, and personasFile are required' });
      return;
    }
    if (!segment || !product) {
      res.status(400).json({ error: 'segment and product must be selected before generating' });
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({
        error: 'ANTHROPIC_API_KEY is not configured on the server. Add it as an environment variable in Railway.',
      });
      return;
    }

    const smsPath = path.join(UPLOADS_DIR, smsTemplateFile);
    const personasPath = path.join(UPLOADS_DIR, personasFile);

    // ── Build campaign cache key ─────────────────────────────────────────────
    const cacheKey = buildCacheKey(segment, product, personasPath, smsPath);
    console.log(`[Generate] Cache key: ${cacheKey}`);

    // ── Check for a previous campaign with the same inputs ───────────────────
    const hit = findByCacheKey(cacheKey);
    if (hit) {
      console.log(
        `[Generate] Cache hit — returning ${hit.messages.length} messages ` +
        `(${hit.approvedCount} approved) for campaign ${hit.campaignId}`
      );
      // Return the ORIGINAL campaignId so the frontend can still call
      // approve/refine endpoints against the existing campaign file.
      res.json({
        cached: true,
        campaignId: hit.campaignId,
        messages: hit.messages,
        count: hit.messages.length,
        approvedCount: hit.approvedCount,
      });
      return;
    }

    // ── Parse files ──────────────────────────────────────────────────────────
    const smsTemplate = await parseSmsTemplate(smsPath);
    const { personas, aiTrainingPack, products, campaignOffer, sheetNames } =
      parsePersonasFile(personasPath);

    console.log(`[Generate] Sheet names: [${sheetNames.join(', ')}]`);
    console.log(
      `[Generate] Parsed: ${personas.length} personas | ` +
      `segment="${segment}" | product="${product}" | ` +
      `offer=${campaignOffer ? `"${campaignOffer}"` : '(none)'}`
    );

    if (personas.length === 0) {
      res.status(400).json({
        error:
          `No personas found. Sheet names detected: [${sheetNames.join(', ')}]. ` +
          `Expected a sheet named "Personas Description".`,
      });
      return;
    }

    // ── Create job and respond immediately (avoids Railway 60s timeout) ──────
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    createJob(jobId, personas.length);

    res.json({ jobId, count: personas.length });

    // ── Run generation asynchronously ────────────────────────────────────────
    const allMessages: GeneratedMessage[] = [];

    (async () => {
      for (const persona of personas) {
        try {
          const { message, criticScore, refinementIterations } =
            await generateWithCriticLoop(
              smsTemplate,
              persona,
              aiTrainingPack,
              products,
              segment,
              product,
              campaignOffer
            );

          console.log(
            `[Generate] ✓ ${persona.name} — ` +
            `quality ${criticScore.score}/10  compliance ${criticScore.complianceScore}/10  ` +
            `${refinementIterations} iteration(s)`
          );

          const msg: GeneratedMessage = {
            personaName: persona.name,
            persona,
            message,
            approved: false,
            segment,
            product,
            criticScore,
            refinementIterations,
          };

          allMessages.push(msg);
          addJobMessage(jobId, msg);

        } catch (err) {
          console.error(`[Generate] ✗ ${persona.name} —`, err);
          // Add a placeholder so the persona shows up in the UI with an error note
          const errMsg: GeneratedMessage = {
            personaName: persona.name,
            persona,
            message: `[Generation failed: ${err instanceof Error ? err.message : String(err)}]`,
            approved: false,
            segment,
            product,
          };
          allMessages.push(errMsg);
          addJobMessage(jobId, errMsg);
        }
      }

      completeJob(jobId);

      // Persist the full campaign result
      saveCampaign({
        id: campaignId,
        cacheKey,
        smsTemplate,
        segment,
        product,
        personas,
        brief: { title: `${product} – ${segment}`, product },
        aiTrainingPack,
        products,
        messages: allMessages,
        createdAt: new Date().toISOString(),
      });

    })().catch((err) => {
      console.error('[Generate] Fatal job error:', err);
      failJob(jobId, err instanceof Error ? err.message : String(err));
    });

  } catch (err) {
    next(err);
  }
});

export default router;
