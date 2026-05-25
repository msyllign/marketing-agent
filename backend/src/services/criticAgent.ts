import Anthropic from '@anthropic-ai/sdk';
import type { CriticScore, Persona, AITrainingPack } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

const SCORE_TOOL: Anthropic.Tool = {
  name: 'score_draft',
  description:
    'Return a structured quality and compliance assessment of the marketing message draft.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score: {
        type: 'number',
        description:
          'Overall quality score 1–10. Considers tone, personalisation, CTA strength, ' +
          'and how well the message serves the target persona.',
      },
      complianceScore: {
        type: 'number',
        description:
          'Compliance score 1–10. How strictly the message follows EVERY rule in the ' +
          'AI Training Pack (language guidelines, forbidden phrases, required elements, ' +
          'structural rules, regulatory constraints). 10 = zero violations.',
      },
      approvalProbability: {
        type: 'number',
        description:
          'Estimated probability (0–100) that the bank\'s compliance unit would approve ' +
          'this message as-is. Penalise heavily for: misleading claims, missing required ' +
          'disclaimers, forbidden language, off-brand tone, or structural deviations from ' +
          'the reference template.',
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 specific things that work well in this message.',
      },
      complianceViolations: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Every guideline from the AI Training Pack that this message violates or ' +
          'partially violates. Empty array if fully compliant.',
      },
      improvements: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Concrete, actionable changes needed to improve both compliance and quality. ' +
          'Reference the specific guideline being violated where applicable.',
      },
    },
    required: [
      'score',
      'complianceScore',
      'approvalProbability',
      'strengths',
      'complianceViolations',
      'improvements',
    ],
  },
};

function buildCriticPrompt(
  message: string,
  referenceTemplate: string,
  persona: Persona,
  aiTrainingPack: AITrainingPack,
  segment: string,
  product: string
): string {
  const guidelines =
    aiTrainingPack.validationGuidelines ||
    aiTrainingPack.languageGuidelines ||
    '';

  return `You are a senior marketing compliance reviewer for a financial institution (bank).

Your role is to evaluate whether a generated Viber marketing message:
  1. Fully complies with the bank's AI Training Pack guidelines
  2. Matches the structural pattern and tone of the approved reference template
  3. Would pass review by the bank's compliance unit

═══════════════════════════════════════════════════
CAMPAIGN CONTEXT
  Segment : ${segment}
  Product : ${product}
  Persona : ${persona.name}
  Description: ${persona.generalDescription ?? 'N/A'}
  Key needs  : ${(persona.needs ?? '').slice(0, 300) || 'N/A'}

═══════════════════════════════════════════════════
AI TRAINING PACK — VALIDATION GUIDELINES
(These are BINDING rules. Every violation must be listed.)

${guidelines ? guidelines.slice(0, 1500) : '(No guidelines provided — use general banking communication standards)'}

═══════════════════════════════════════════════════
REFERENCE TEMPLATE (previously approved communication)
This template shows the approved structure, tone, and style.
The generated message should follow this pattern closely.

"${referenceTemplate}"

═══════════════════════════════════════════════════
GENERATED MESSAGE TO EVALUATE

"${message}"

═══════════════════════════════════════════════════
EVALUATION INSTRUCTIONS

1. Read EVERY guideline in the AI Training Pack above.
2. Check the generated message against each guideline one by one.
3. Compare the message structure, tone, and elements to the Reference Template.
4. Score compliance STRICTLY — any guideline violation lowers the complianceScore.
5. Estimate approvalProbability based on: number of violations, severity of violations,
   regulatory risk, and deviation from the reference template.
   - 90-100%: fully compliant, matches template, no risks
   - 70-89%: minor issues, easily fixed
   - 50-69%: moderate violations, would likely require revision
   - 30-49%: significant violations, likely rejected
   - 0-29%: major violations, regulatory risk, would be rejected

Use the score_draft tool to return your complete assessment.`;
}

/**
 * Evaluate a draft against the AI Training Pack and reference template.
 * Returns quality score, compliance score, approval probability, and detailed feedback.
 */
export async function scoreDraft(
  message: string,
  referenceTemplate: string,
  persona: Persona,
  aiTrainingPack: AITrainingPack,
  segment: string,
  product: string
): Promise<CriticScore> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [SCORE_TOOL],
    tool_choice: { type: 'tool', name: 'score_draft' },
    messages: [
      {
        role: 'user',
        content: buildCriticPrompt(
          message,
          referenceTemplate,
          persona,
          aiTrainingPack,
          segment,
          product
        ),
      },
    ],
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
