import Anthropic from '@anthropic-ai/sdk';
import type {
  Persona,
  CampaignBrief,
  AITrainingPack,
  ProductDescription,
  CriticScore,
} from '../types';
import { scoreDraft } from './criticAgent';
import { buildFeedbackContext } from './feedbackStore';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

// Agentic loop settings
const SCORE_THRESHOLD = 6;  // exit loop once score ≥ 6 (good enough)
const MAX_ITERATIONS = 2;   // at most 2 attempts per persona

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(trainingPack: AITrainingPack): string {
  const parts: string[] = [];

  if (trainingPack.roleDefinition) {
    parts.push(trainingPack.roleDefinition);
  } else {
    parts.push(
      'You are an expert marketing copywriter specializing in CRM communications for bank customers.'
    );
  }

  if (trainingPack.languageGuidelines) {
    parts.push('\nLanguage and Style Guidelines:\n' + trainingPack.languageGuidelines);
  }

  if (trainingPack.segmentDifferentiation) {
    parts.push('\nSegment Differentiation:\n' + trainingPack.segmentDifferentiation);
  }

  parts.push(
    '\nYour task is to generate personalized Rich Viber messages for each customer segment. ' +
    'Messages should be concise, engaging, and tailored to the specific life-stage and needs of the persona. ' +
    'Use the base SMS template as inspiration but adapt the tone, emphasis, and content for each segment. ' +
    'Keep messages under 1000 characters for Viber compatibility. ' +
    'Respond ONLY with the message text — no explanations, no labels, no quotes.'
  );

  return parts.join('\n\n');
}

function buildCopywriterPrompt(
  smsTemplate: string,
  persona: Persona,
  brief: CampaignBrief,
  products: ProductDescription,
  feedbackContext: string,
  previousDraft?: string,
  critiqueImprovements?: string[]
): string {
  const personaDetails: string[] = [];
  if (persona.generalDescription) {
    personaDetails.push(`General Description: ${persona.generalDescription}`);
  }
  if (persona.needs) {
    personaDetails.push(`Key Needs: ${persona.needs.slice(0, 500)}`);
  }
  if (persona.milestones) {
    personaDetails.push(`Life Milestones: ${persona.milestones.slice(0, 300)}`);
  }

  const productInfo = Object.entries(products)
    .map(([name, p]) => `${name}: ${p.description?.slice(0, 150) ?? ''}`)
    .join('\n');

  const briefContext: string[] = [];
  if (brief.title) briefContext.push(`Campaign: ${brief.title}`);
  if (brief.primaryMessage) briefContext.push(`Primary Message: ${brief.primaryMessage}`);
  if (brief.secondaryMessage) briefContext.push(`Secondary: ${brief.secondaryMessage?.slice(0, 200)}`);
  if (brief.crossSell) briefContext.push(`Cross-sell: ${brief.crossSell}`);
  if (brief.additionalInfo) briefContext.push(`Additional: ${brief.additionalInfo?.slice(0, 200)}`);

  let prompt = `Generate a personalized Rich Viber message for:

PERSONA: ${persona.name}
${personaDetails.join('\n')}

CAMPAIGN CONTEXT:
${briefContext.join('\n')}

PRODUCTS:
${productInfo}`;

  // Inject past feedback if available
  if (feedbackContext) {
    prompt += `\n\n${feedbackContext}`;
  }

  // Refinement instruction when improving a previous draft
  if (previousDraft && critiqueImprovements?.length) {
    prompt += `\n\nPREVIOUS DRAFT (needs improvement):
"${previousDraft}"

CRITIC FEEDBACK — address ALL of these:
${critiqueImprovements.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Write an improved version that fixes every point above.`;
  } else {
    prompt += `\n\nBASE SMS TEMPLATE (adapt for this persona):
"${smsTemplate}"

Generate a personalized Viber message for "${persona.name}". Be concise, engaging, in Greek, under 1000 characters.`;
  }

  return prompt;
}

// ── Single-shot message generation ──────────────────────────────────────────

async function generateDraft(
  smsTemplate: string,
  persona: Persona,
  brief: CampaignBrief,
  aiTrainingPack: AITrainingPack,
  products: ProductDescription,
  feedbackContext: string,
  previousDraft?: string,
  critiqueImprovements?: string[]
): Promise<string> {
  const systemPrompt = buildSystemPrompt(aiTrainingPack);
  const userPrompt = buildCopywriterPrompt(
    smsTemplate,
    persona,
    brief,
    products,
    feedbackContext,
    previousDraft,
    critiqueImprovements
  );

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  return content.text.trim();
}

// ── Agentic loop: Copywriter → Critic → Refine ───────────────────────────────

/**
 * Run the full agentic generation loop for one persona:
 * 1. Load past feedback context
 * 2. Generate draft
 * 3. Critic scores it
 * 4. If score < threshold, refine and repeat (max iterations)
 * 5. Return best message with metadata
 */
export async function generateWithCriticLoop(
  smsTemplate: string,
  persona: Persona,
  brief: CampaignBrief,
  aiTrainingPack: AITrainingPack,
  products: ProductDescription
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

    // Generate (or refine previous draft)
    currentDraft = await generateDraft(
      smsTemplate,
      persona,
      brief,
      aiTrainingPack,
      products,
      feedbackContext,
      i > 0 ? currentDraft : undefined,
      i > 0 ? currentScore.improvements : undefined
    );

    // Critic evaluation
    currentScore = await scoreDraft(currentDraft, persona, brief, aiTrainingPack);
    console.log(
      `[Agent] ${persona.name} — score ${currentScore.score}/10 ` +
      `(threshold ${SCORE_THRESHOLD})`
    );

    if (currentScore.score >= SCORE_THRESHOLD) break;
  }

  return {
    message: currentDraft,
    criticScore: currentScore,
    refinementIterations: iterationsUsed,
  };
}

// ── Legacy single-shot (kept for backward compat) ────────────────────────────

export async function generatePersonalizedMessage(
  smsTemplate: string,
  persona: Persona,
  brief: CampaignBrief,
  aiTrainingPack: AITrainingPack,
  products: ProductDescription
): Promise<string> {
  const feedbackContext = buildFeedbackContext(persona.name);
  return generateDraft(smsTemplate, persona, brief, aiTrainingPack, products, feedbackContext);
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
      'You are an expert marketing copywriter. Refine the given Viber marketing message based on the user feedback. ' +
      'Respond ONLY with the refined message text — no explanations, no labels, no quotes.',
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
