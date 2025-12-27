import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { config } from '../config';

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return client;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  temperature?: number;
  maxTokens?: number;
}

export async function createChatCompletion(options: ChatCompletionOptions) {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: options.model ?? config.openai.model,
    messages: options.messages,
    tools: options.tools,
    tool_choice: options.tools ? 'auto' : undefined,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  });

  return response;
}

export async function routeIntent(
  userMessage: string,
  conversationContext: string
): Promise<{
  intent: string;
  confidence: number;
  reasoning: string;
}> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: config.openai.routerModel,
    messages: [
      {
        role: 'system',
        content: `You are an intent router for a business assistant bot. Analyze the user's message and determine the appropriate state/mode for handling it.

Available states:
- chat: General conversation, greetings, off-topic discussion
- planning: Discussing business ideas, brainstorming, strategy
- creating: Ready to create resources (domains, repos, Discord servers)
- managing: Managing existing projects, checking status
- researching: Deep research mode, market analysis, competitor research
- cleanup: Cleaning up/deleting projects and their resources

Context from conversation:
${conversationContext}

Respond with JSON only:
{
  "intent": "<state>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content ?? '{}';

  try {
    return JSON.parse(content);
  } catch {
    return {
      intent: 'chat',
      confidence: 0.5,
      reasoning: 'Failed to parse router response',
    };
  }
}

export async function generateSummary(
  content: string,
  maxLength = 200
): Promise<string> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: config.openai.routerModel,
    messages: [
      {
        role: 'system',
        content: `Summarize the following content in ${maxLength} characters or less. Be concise and capture the key points.`,
      },
      {
        role: 'user',
        content,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content ?? content.substring(0, maxLength);
}

export async function extractApprovalIntent(
  message: string
): Promise<{
  isApproval: boolean;
  isRejection: boolean;
  confidence: number;
}> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: config.openai.routerModel,
    messages: [
      {
        role: 'system',
        content: `Analyze if this message is approving or rejecting a proposed action.

Approval signals: yes, approve, go ahead, do it, sounds good, let's do it, confirmed, ok, etc.
Rejection signals: no, reject, don't, cancel, stop, not now, wait, etc.

Respond with JSON only:
{
  "isApproval": <boolean>,
  "isRejection": <boolean>,
  "confidence": <0.0-1.0>
}`,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content ?? '{}';

  try {
    return JSON.parse(content);
  } catch {
    return {
      isApproval: false,
      isRejection: false,
      confidence: 0,
    };
  }
}
