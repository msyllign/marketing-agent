import Anthropic from '@anthropic-ai/sdk';
import type {
  Persona,
  CampaignBrief,
  AITrainingPack,
  ProductDescription,
} from '../types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-6';

/**
 * Build a system prompt for the campaign copywriter role,
 * incorporating the AI Training Pack guidelines.
 */
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

/**
 * Build the user prompt for generating a message for a specific persona.
 */
function buildUserPrompt(
  smsTemplate: string,
  persona: Persona,
  brief: CampaignBrief,
  products: ProductDescription
): string {
  const personaDetails: string[] = [];

  if (persona.generalDescription) {
    personaDetails.push(`General Description: ${persona.generalDescription}`);
  }
  if (persona.needs) {
    // Truncate long needs text to avoid overly long prompts
    const needsPreview = persona.needs.slice(0, 500);
    personaDetails.push(`Key Needs: ${needsPreview}`);
  }
  if (persona.milestones) {
    const milestonesPreview = persona.milestones.slice(0, 300);
    personaDetails.push(`Life Milestones: ${milestonesPreview}`);
  }

  const productInfo = Object.entries(products)
    .map(([name, p]) => `${name}: ${p.description?.slice(0, 150) || ''}`)
    .join('\n');

  const briefContext: string[] = [];
  if (brief.title) briefContext.push(`Campaign: ${brief.title}`);
  if (brief.primaryMessage) briefContext.push(`Primary Message: ${brief.primaryMessage}`);
  if (brief.secondaryMessage) briefContext.push(`Secondary Message: ${brief.secondaryMessage?.slice(0, 200)}`);
  if (brief.crossSell) briefContext.push(`Cross-sell: ${brief.crossSell}`);
  if (brief.additionalInfo) briefContext.push(`Additional Info: ${brief.additionalInfo?.slice(0, 200)}`);

  return `Generate a personalized Rich Viber message for the following customer segment:

PERSONA: ${persona.name}
${personaDetails.join('\n')}

CAMPAIGN CONTEXT:
${briefContext.join('\n')}

PRODUCTS:
${productInfo}

BASE SMS TEMPLATE (use as inspiration, adapt for the persona):
"${smsTemplate}"

Generate a personalized Viber message for the "${persona.name}" segment. The message should:
- Be relevant to their life stage and needs
- Promote the Silver credit card activation/usage
- Include a call-to-action
- Be in Greek (same language as the template)
- Be concise and engaging (under 1000 characters)`;
}

/**
 * Generate a personalized Viber message for a single persona.
 */
export async function generatePersonalizedMessage(
  smsTemplate: string,
  persona: Persona,
  brief: CampaignBrief,
  aiTrainingPack: AITrainingPack,
  products: ProductDescription
): Promise<string> {
  const systemPrompt = buildSystemPrompt(aiTrainingPack);
  const userPrompt = buildUserPrompt(smsTemplate, persona, brief, products);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  return content.text.trim();
}

/**
 * Refine an existing message based on user feedback.
 */
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
        content: `Original message:\n"${originalMessage}"\n\nFeedback: ${feedback}\n\nPlease provide the refined message.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  return content.text.trim();
}
