import Anthropic from '@anthropic-ai/sdk';
import type { CriticScore, Persona, CampaignBrief, AITrainingPack } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

const SCORE_TOOL: Anthropic.Tool = {
  name: 'score_draft',
  description: 'Return a structured quality assessment of the marketing message draft.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: {
        type: 'number',
        description: 'Quality score from 1 (very poor) to 10 (excellent)',
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 specific things that work well in this message',
      },
      improvements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 concrete improvements needed (empty if score >= 8)',
      },
    },
    required: ['score', 'strengths', 'improvements'],
  },
};

function buildCriticPrompt(
  message: string,
  persona: Persona,
  brief: CampaignBrief,
  aiTrainingPack: AITrainingPack
): string {
  const languageGuideline = aiTrainingPack.languageGuidelines
    ? `\nBrand language guidelines:\n${aiTrainingPack.languageGuidelines.slice(0, 400)}`
    : '';

  return `You are a senior marketing quality reviewer for a bank.

Evaluate the following Viber marketing message for the "${persona.name}" customer segment.

PERSONA PROFILE:
- General: ${persona.generalDescription ?? 'N/A'}
- Key needs: ${(persona.needs ?? '').slice(0, 300)}

CAMPAIGN GOAL: ${brief.primaryMessage ?? brief.title ?? 'Increase credit card usage'}
${languageGuideline}

MESSAGE TO EVALUATE:
"${message}"

Score this message on:
1. Relevance to the persona's life stage and needs
2. Clarity and strength of the call-to-action
3. Tone appropriateness for the segment
4. Conciseness (Viber messages should be under 1000 chars)
5. Compliance with brand language guidelines

Use the score_draft tool to return your assessment.`;
}

/**
 * Evaluate a message draft and return a structured quality score.
 * Uses forced tool use so the response is always typed JSON — no parsing fragility.
 */
export async function scoreDraft(
  message: string,
  persona: Persona,
  brief: CampaignBrief,
  aiTrainingPack: AITrainingPack
): Promise<CriticScore> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [SCORE_TOOL],
    tool_choice: { type: 'tool', name: 'score_draft' },
    messages: [
      {
        role: 'user',
        content: buildCriticPrompt(message, persona, brief, aiTrainingPack),
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Critic agent did not return a tool_use block');
  }

  const input = toolUse.input as {
    score: number;
    strengths: string[];
    improvements: string[];
  };

  return {
    score: Math.min(10, Math.max(1, Math.round(input.score))),
    strengths: input.strengths ?? [],
    improvements: input.improvements ?? [],
  };
}
