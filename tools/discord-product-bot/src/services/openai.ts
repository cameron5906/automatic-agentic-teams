import OpenAI from 'openai';
import { config } from '../config.js';
import type { ClassificationResult, ProductUpdateResult } from '../types.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const CLASSIFICATION_PROMPT = `You are analyzing a Discord message to determine if it should become a GitHub issue for the StoryOfYourLife project.

Message: {content}
Author: {author}

Analyze and respond with JSON only (no markdown):
{
  "isDevRelated": boolean,
  "reasoning": string,
  "issue": {
    "title": string,
    "body": string,
    "labels": string[]
  }
}

Rules:
- Questions about code, features, bugs, UX → isDevRelated: true
- General chat, off-topic, greetings → isDevRelated: false
- Product feedback or feature requests → isDevRelated: true
- Technical questions → isDevRelated: true
- If isDevRelated is false, omit the "issue" field

For issue.labels, use: bug, enhancement, question, documentation, or leave empty if unsure.
For issue.body, format as markdown with context about the original Discord request.`;

const PRODUCT_UPDATE_PROMPT = `You are creating a user-friendly product update from a technical dev message for the StoryOfYourLife project.

Dev message: {content}

Create a brief, exciting product update for non-technical users.
Focus on benefits, not implementation details.
Keep it under 200 characters.
Use emoji sparingly (0-2 max).

Respond with JSON only (no markdown):
{
  "shouldPost": boolean,
  "update": string
}

Only set shouldPost to true if this is a significant user-facing change (new feature, major bug fix, etc).
Minor internal changes, refactors, or CI updates should have shouldPost: false.`;

export async function classifyMessage(
  content: string,
  author: string
): Promise<ClassificationResult> {
  const prompt = CLASSIFICATION_PROMPT
    .replace('{content}', content)
    .replace('{author}', author);

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(text) as ClassificationResult;
}

export async function createProductUpdate(
  content: string
): Promise<ProductUpdateResult> {
  const prompt = PRODUCT_UPDATE_PROMPT.replace('{content}', content);

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(text) as ProductUpdateResult;
}
