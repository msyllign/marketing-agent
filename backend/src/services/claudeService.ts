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

// Agentic loop settings
const SCORE_THRESHOLD = 6;   // exit loop once score ≥ 6
const MAX_ITERATIONS = 2;    // at most 2 attempts per persona

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(
  aiTrainingPack: AITrainingPack,
  segment: string,
  product: string
): string {
  const parts: string[] = [];

  if (aiTrainingPack.roleDefinition) {
    parts.push(aiTrainingPack.roleDefinition);
  } else {
    parts.push(
      'You are an expert marketing copywriter specialising in CRM communications for bank customers.'
    );
  }

  parts.push(
    `\nYou are creating messages for the **${segment}** customer segment ` +
    `promoting **${product}**.`
  );

  if (aiTrainingPack.languageGuidelines) {
    parts.push('\nLanguage & Style Guidelines:\n' + aiTrainingPack.languageGuidelines);
  }

  if (aiTrainingPack.segmentDifferentiation) {
    parts.push('\nSegment Differentiation:\n' + aiTrainingPack.segmentDifferentiation);
  }

  parts.push(
    '\nGenerate personalized Rich Viber messages. ' +
    'Messages must be concise, engaging, tailored to the persona, in Greek, ' +
    'and under 1000 characters. ' +
    'Respond ONLY with the message text — no explanations, no labels, no quotes.'
  );

  return parts.join('\n\n');
}

function buildCopywriterPrompt(
  smsTemplate: string,
  persona: Persona,
  segment: string,
  product: string,
  productDetails: string,
  feedbackContext: string,
  previousDraft?: string,
  critiqueImprovements?: string[]
): string {
  const personaLines: string[] = [];
  if (persona.generalDescription) personaLines.push(`Description: ${persona.generalDescription}`);
  if (persona.needs)             personaLines.push(`Key Needs: ${persona.needs.slice(0, 500)}`);
  if (persona.milestones)        personaLines.push(`Life Milestones: ${persona.milestones.slice(0, 300)}`);

  let prompt =
    `Generate a personalized Rich Viber message for the following customer:

SEGMENT: ${segment}
PRODUCT: ${product}

PERSONA: ${persona.name}
${personaLines.join('\n') || '(no additional details)'}

PRODUCT DETAILS:
${productDetails || '(see product sheet)'}`;

  if (feedbackContext) {
    prompt += `\n\n${feedbackContext}`;
  }

  if (previousDraft && critiqueImprovements?.length) {
    prompt +=
      `\n\nPREVIOUS DRAFT (needs improvement):
"${previousDraft}"

CRITIC FEEDBACK — address ALL of these points:
${critiqueImprovements.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Write an improved version that addresses every point above.`;
  } else {
    prompt +=
      `\n\nBASE TEMPLATE (adapt tone and content for this persona):
"${smsTemplate}"

Generate a personalized Viber message for "${persona.name}" — in Greek, under 1000 characters.`;
  }

  return prompt;
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
    system: buildSystemPrompt(aiTrainingPack, segment, product),
    messages: [
      {
        role: 'user',
        content: buildCopywriterPrompt(
          smsTemplate,
          persona,
          segment,
          product,
          productDetails,
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
  let currentScore: CriticScore = { score: 0, strengths: [], improvements: [] };
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
      i > 0 ? currentScore.improvements : undefined
    );

    currentScore = await scoreDraft(
      currentDraft,
      persona,
      aiTrainingPack,
      segment,
      product
    );

    console.log(
      `[Agent] ${persona.name} — score ${currentScore.score}/10 (threshold ${SCORE_THRESHOLD})`
    );

    if (currentScore.score >= SCORE_THRESHOLD) break;
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
    system:
      'You are an expert marketing copywriter. Refine the given Viber marketing message ' +
      'based on the user feedback. Respond ONLY with the refined message text — no explanations.',
    messages: [
      {
        role: 'user',
        content: `Original message:\n"${originalMessage}"\n\nFeedback: ${feedback}\n\nWrite the refined message.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return content.text.trim();
}
