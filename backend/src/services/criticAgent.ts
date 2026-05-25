import Anthropic from '@anthropic-ai/sdk';
import type { CriticScore, Persona, AITrainingPack } from '../types';

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
        description: 'Up to 3 concrete improvements needed (empty array if score >= 8)',
      },
    },
    required: ['score', 'strengths', 'improvements'],
  },
};

function buildCriticPrompt(
  message: string,
  persona: Persona,
  aiTrainingPack: AITrainingPack,
  segment: string,
  product: string
): string {
  const guidelines =
    aiTrainingPack.validationGuidelines ||
    aiTrainingPack.languageGuidelines ||
    '';

  return `You are a senior marketing quality reviewer for a bank.

Evaluate the following Viber message for the **${segment}** customer segment promoting **${product}**.

PERSONA: ${persona.name}
- Description: ${persona.generalDescription ?? 'N/A'}
- Key needs: ${(persona.needs ?? '').slice(0, 300) || 'N/A'}

${guidelines ? `VALIDATION GUIDELINES (AI Training Pack):\n${guidelines.slice(0, 800)}\n` : ''}

MESSAGE TO EVALUATE:
"${message}"

Score this message on:
1. Relevance to the persona's profile and needs
2. Appropriateness for the **${segment}** segment
3. Clarity and strength of the call-to-action for **${product}**
4. Compliance with the validation guidelines above
5. Conciseness (under 1000 characters, natural Greek language)

Use the score_draft tool to return your structured assessment.`;
}

/**
 * Evaluate a draft and return a structured quality score.
 * Forced tool use guarantees typed JSON output — no parsing fragility.
 */
export async function scoreDraft(
  message: string,
  persona: Persona,
  aiTrainingPack: AITrainingPack,
  segment: string,
  product: string
): Promise<CriticScore> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [SCORE_TOOL],
    tool_choice: { type: 'tool', name: 'score_draft' },
    messages: [
      {
        role: 'user',
        content: buildCriticPrompt(message, persona, aiTrainingPack, segment, product),
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
