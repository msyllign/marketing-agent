import Anthropic from '@anthropic-ai/sdk';
import type { CriticScore, Persona, AITrainingPack } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

const SCORE_TOOL: Anthropic.Tool = {
  name: 'score_draft',
  description: 'Return a structured quality and compliance assessment of the marketing message draft.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: {
        type: 'number',
        description: 'Overall quality score 1–10.',
      },
      complianceScore: {
        type: 'number',
        description:
          'Compliance score 1–10. How strictly the message follows EVERY rule in the ' +
          'AI Training Pack. 10 = zero violations.',
      },
      approvalProbability: {
        type: 'number',
        description:
          'Estimated probability 0–100 that the compliance unit approves this message. ' +
          '90-100: fully compliant. 70-89: minor issues. 50-69: needs revision. ' +
          '30-49: significant violations. 0-29: major violations / regulatory risk.',
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 specific things that work well.',
      },
      complianceViolations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Every guideline violated. Empty if fully compliant.',
      },
      improvements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Concrete actionable changes needed.',
      },
    },
    required: ['score', 'complianceScore', 'approvalProbability', 'strengths', 'complianceViolations', 'improvements'],
  },
};

/**
 * Cached system prompt block for the critic.
 * Contains all stable content: role + guidelines + reference template + offer policy.
 * Reused across all persona evaluations in the same campaign.
 */
function buildCachedCriticSystemBlocks(
  aiTrainingPack: AITrainingPack,
  referenceTemplate: string,
  segment: string,
  product: string,
  campaignOffer: string | null
): Anthropic.TextBlockParam[] {
  const guidelines =
    aiTrainingPack.validationGuidelines ||
    aiTrainingPack.languageGuidelines ||
    '(No guidelines provided — use general banking communication standards)';

  const offerRule = campaignOffer
    ? `═══ OFFER COMPLIANCE RULE ═══
This campaign includes ONE specific approved offer: "${campaignOffer}"
Only this exact offer is valid. If the message contains any OTHER offer, discount, cashback,
reward, bonus points, sweepstakes, or promotion — that is a compliance violation.
List it in complianceViolations.`
    : `═══ OFFER COMPLIANCE RULE ═══
This campaign has NO specific offer. The Product Description offer field is blank.
If the evaluated message contains ANY offer, discount, cashback, reward, bonus points,
sweepstakes, or promotion — including any found in the Reference Template — that is a
HARD compliance violation. List it explicitly in complianceViolations and lower
complianceScore and approvalProbability accordingly.`;

  const text = `You are a senior marketing compliance reviewer for a financial institution (bank).

Campaign: ${segment} segment · ${product}

═══ AI TRAINING PACK — VALIDATION GUIDELINES (BINDING RULES) ═══
${guidelines.slice(0, 1500)}

═══ REFERENCE TEMPLATE (communication style guide — NOT a source of offers) ═══
"${referenceTemplate}"
NOTE: The template above shows approved tone and structure only. Any offer visible in it
belonged to a previous campaign and is NOT valid for this campaign.

${offerRule}

EVALUATION INSTRUCTIONS:
1. Check the message against EVERY guideline above.
2. Compare structure and tone to the Reference Template.
3. Apply the Offer Compliance Rule strictly — any violation is a hard failure.
4. Score complianceScore strictly — any violation lowers it.
5. Set approvalProbability based on violation count and severity.
6. List EVERY violated guideline in complianceViolations.`;

  return [
    {
      type: 'text',
      text,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

export async function scoreDraft(
  message: string,
  referenceTemplate: string,
  persona: Persona,
  aiTrainingPack: AITrainingPack,
  segment: string,
  product: string,
  campaignOffer: string | null
): Promise<CriticScore> {
  const userContent =
    `PERSONA: ${persona.name}\n` +
    `Description: ${persona.generalDescription ?? 'N/A'}\n` +
    `Product profile: ${persona.productProfile ?? 'N/A'}\n\n` +
    `MESSAGE TO EVALUATE:\n"${message}"\n\n` +
    `Use the score_draft tool to return your assessment.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [SCORE_TOOL],
    tool_choice: { type: 'tool', name: 'score_draft' },
    system: buildCachedCriticSystemBlocks(aiTrainingPack, referenceTemplate, segment, product, campaignOffer),
    messages: [{ role: 'user', content: userContent }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Critic agent did not return a tool_use block');
  }

  const input = toolUse.input as {
    score: number;
    complianceScore: number;
    approvalProbability: number;
    strengths: string[];
    complianceViolations: string[];
    improvements: string[];
  };

  return {
    score: Math.min(10, Math.max(1, Math.round(input.score))),
    complianceScore: Math.min(10, Math.max(1, Math.round(input.complianceScore))),
    approvalProbability: Math.min(100, Math.max(0, Math.round(input.approvalProbability))),
    strengths: input.strengths ?? [],
    complianceViolations: input.complianceViolations ?? [],
    improvements: input.improvements ?? [],
  };
}
