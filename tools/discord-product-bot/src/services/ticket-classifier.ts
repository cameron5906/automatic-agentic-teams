import OpenAI from 'openai';
import { config } from '../config.js';

export interface TicketWorthinessResult {
  isTicketWorthy: boolean;
  reason: string;
  suggestedThreadName: string;
}

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const PROMPT = `You are classifying a Discord message for the StoryOfYourLife project.

We use GitHub issues as the primary way to communicate actionable work to the team.

Decide if this message is "ticket-worthy" (likely to become a GitHub issue). Ticket-worthy examples:
- bug reports, broken behavior, errors, performance issues
- feature requests, enhancements, UX changes
- review requests
- build/test/CI failures

Not ticket-worthy examples:
- simple questions that can be answered immediately without follow-up
- greetings, acknowledgments, chit-chat

Return JSON only (no markdown):
{
  "isTicketWorthy": boolean,
  "reason": string,
  "suggestedThreadName": string
}

Guidelines:
- Prefer isTicketWorthy=true when uncertain; we want to capture actionable work in GitHub.
- suggestedThreadName should be short, descriptive, and <= 100 characters.

Message: {content}
Author: {author}`;

function sanitizeThreadName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Ticket discussion';
  return trimmed.slice(0, 100);
}

export async function classifyTicketWorthiness(params: {
  content: string;
  author: string;
}): Promise<TicketWorthinessResult> {
  const prompt = PROMPT.replace('{content}', params.content).replace(
    '{author}',
    params.author
  );

  const response = await openai.chat.completions.create({
    model: config.openai.model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(text) as TicketWorthinessResult;
  return {
    isTicketWorthy: Boolean(parsed.isTicketWorthy),
    reason: String(parsed.reason ?? ''),
    suggestedThreadName: sanitizeThreadName(
      typeof parsed.suggestedThreadName === 'string'
        ? parsed.suggestedThreadName
        : 'Ticket discussion'
    ),
  };
}





