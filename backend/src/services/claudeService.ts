import Anthropic from '@anthropic-ai/sdk';
import type {
  Persona,
  AITrainingPack,
  ProductDescription,
  CriticScore,
} from '../types';
import { scoreDraft } from './criticAgent';
import { buildFeedbackContext } from './feedbackStore';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// Agentic loop settings — exit when BOTH quality and compliance reach threshold
const SCORE_THRESHOLD = 6;
const COMPLIANCE_THRESHOLD = 6;
const MAX_ITERATIONS = 2;

// ── Prompt builders ──────────────────────────────────────────────────────────

/**
 * Build the CACHED system prompt block.
 * Contains everything that is stable across all persona generations in one campaign:
 * role + AI training pack + product details + reference template.
 * Marked with cache_control so Anthropic reuses it across all API calls.
 */
function buildCachedSystemBlocks(
  aiTrainingPack: AITrainingPack,
  productDetails: string,
  referenceTemplate: string,
  segment: string,
  product: string
): Anthropic.TextBlockParam[] {
  const lines: string[] = [];

  lines.push(
    aiTrainingPack.roleDefinition ||
    'You are an expert marketing copywriter specialising in CRM communications for bank customers.'
  );

  lines.push(`\nCampaign: ${segment} segment · ${product}`);

  if (aiTrainingPack.validationGuidelines) {
    lines.push('\nAI Training Pack Guidelines:\n' + aiTrainingPack.validationGuidelines);
  } else if (aiTrainingPack.languageGuidelines) {
    lines.push('\nLanguage Guidelines:\n' + aiTrainingPack.languageGuidelines);
  }

  if (productDetails) {
    lines.push('\nProduct Details:\n' + productDetails);
  }

  lines.push(
    `\nReference Template (previously approved communication):\n"${referenceTemplate}"`
  );

  lines.push(
    '\nYour task: Generate personalized Rich Viber messages in Greek, under 1000 characters. ' +
    'Respond ONLY with the message text — no labels, no quotes, no explanations.'
  );

  return [
    {
      type: 'text',
      text: lines.join('\n'),
      cache_control: { type: 'ephemeral' },
    },
  ];
}

/**
 * Build the per-persona user message.
 * Contains only what changes per persona: base profile + product-specific row + feedback.
 * This is NOT cached (it's small and unique per persona).
 */
function buildPersonaUserMessage(
  persona: Persona,
  feedbackContext: string,
  previousDraft?: string,
  critiqueImprovements?: string[]
): string {
  const baseLines: string[] = [];
  if (persona.generalDescription) baseLines.push(`Description: ${persona.generalDescription}`);
  if (persona.needs)             baseLines.push(`Needs: ${persona.needs.slice(0, 300)}`);
  if (persona.milestones)        baseLines.push(`Milestones: ${persona.milestones.slice(0, 200)}`);
  if (persona.communication)     baseLines.push(`Communication style: ${persona.communication}`);

  let msg = `PERSONA: ${persona.name}\n`;
  if (baseLines.length) msg += baseLines.join('\n') + '\n';

  if (persona.productProfile) {
    msg += `\nPRODUCT-SPECIFIC PROFILE:\n${persona.productProfile}\n`;
  }

  if (feedbackContext) {
    msg += `\n${feedbackContext}\n`;
  }

  if (previousDraft && critiqueImprovements?.length) {
    msg +=
      `\nPREVIOUS DRAFT (needs improvement):\n"${previousDraft}"\n\n` +
      `CRITIC FEEDBACK — fix ALL of these:\n` +
      critiqueImprovements.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      `\n\nWrite an improved version that addresses every point.`;
  } else {
    msg += `\nGenerate a personalized Viber message for "${persona.name}".`;
  }

  return msg;
}

// ── Single-shot generation ───────────────────────────────────────────────────

async function generateDraft(
  smsTemplate: string,
  persona: Persona,
  aiTrainingPack: AITrainingPack,
  products: ProductDescription,
  segment: string,
  product: string,
  feedbackContext: string,
  previousDraft?: string,
  critiqueImprovements?: string[]
): Promise<string> {
  const productDetails = products['product']?.description ?? '';

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildCachedSystemBlocks(aiTrainingPack, productDetails, smsTemplate, segment, product),
    messages: [
      {
        role: 'user',
        content: buildPersonaUserMessage(
          persona,
          feedbackContext,
          previousDraft,
          critiqueImprovements
        ),
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return content.text.trim();
}

// ── Agentic loop ─────────────────────────────────────────────────────────────

export async function generateWithCriticLoop(
  smsTemplate: string,
  persona: Persona,
  aiTrainingPack: AITrainingPack,
  products: ProductDescription,
  segment: string,
  product: string
): Promise<{
  message: string;
  criticScore: CriticScore;
  refinementIterations: number;
}> {
  const feedbackContext = buildFeedbackContext(persona.name);
  let currentDraft = '';
  let currentScore: CriticScore = {
    score: 0,
    complianceScore: 0,
    approvalProbability: 0,
    strengths: [],
    complianceViolations: [],
    improvements: [],
  };
  let iterationsUsed = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterationsUsed = i + 1;
    console.log(`[Agent] ${persona.name} — iteration ${iterationsUsed}/${MAX_ITERATIONS}`);

    currentDraft = await generateDraft(
      smsTemplate,
      persona,
      aiTrainingPack,
      products,
      segment,
      product,
      feedbackContext,
      i > 0 ? currentDraft : undefined,
      i > 0
        ? [...(currentScore.complianceViolations ?? []), ...(currentScore.improvements ?? [])]
        : undefined
    );

    currentScore = await scoreDraft(
      currentDraft,
      smsTemplate,
      persona,
      aiTrainingPack,
      segment,
      product
    );

    console.log(
      `[Agent] ${persona.name} — quality ${currentScore.score}/10  ` +
      `compliance ${currentScore.complianceScore}/10  ` +
      `approval ${currentScore.approvalProbability}%`
    );

    if (
      currentScore.score >= SCORE_THRESHOLD &&
      currentScore.complianceScore >= COMPLIANCE_THRESHOLD
    ) break;
  }

  return { message: currentDraft, criticScore: currentScore, refinementIterations: iterationsUsed };
}

// ── User-triggered refinement ────────────────────────────────────────────────

export async function refineMessage(
  originalMessage: string,
  feedback: string
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: 'You are an expert marketing copywriter. Refine the given Viber marketing message ' +
      'based on the user feedback. Respond ONLY with the refined message text.',
    messages: [
      {
        role: 'user',
        content: `Original:\n"${originalMessage}"\n\nFeedback: ${feedback}\n\nWrite the refined message.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return content.text.trim();
}
