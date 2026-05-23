import Anthropic from '@anthropic-ai/sdk';
import { Persona } from '../types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate a personalised Viber/SMS message for a single persona.
 */
export async function generatePersonalisedMessage(
  smsTemplate: string,
  persona: Persona
): Promise<string> {
  const personaDescription = Object.entries(persona)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const prompt = `You are a marketing copywriter. Personalise the following SMS template for a specific customer persona.

SMS Template:
"""
${smsTemplate}
"""

Customer Persona:
${personaDescription}

Rules:
- Keep the message concise (max 160 characters for SMS, or up to 1000 for Viber rich messages)
- Naturally incorporate persona details to make the message feel personal
- Maintain the core offer/call-to-action from the template
- Use the customer's name if available
- Output ONLY the final message text, no explanations or labels

Personalised message:`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text.trim();
}

/**
 * Refine an existing message based on user feedback.
 */
export async function refineMessageWithFeedback(
  originalMessage: string,
  feedback: string
): Promise<string> {
  const prompt = `You are a marketing copywriter. Refine the following marketing message based on the user's feedback.

Original message:
"""
${originalMessage}
"""

User feedback / requested changes:
"""
${feedback}
"""

Rules:
- Apply the requested changes faithfully
- Keep the message concise and impactful
- Output ONLY the refined message text, no explanations or labels

Refined message:`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text.trim();
}
