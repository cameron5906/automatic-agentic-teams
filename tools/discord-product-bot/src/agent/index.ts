import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPart,
} from 'openai/resources/chat/completions';
import { config } from '../config.js';
import { tools } from '../tools/index.js';
import { buildSystemPrompt } from './system-prompt.js';
import { executeToolCall } from './tool-executor.js';
import type { MessageContext } from '../types.js';
import { team_get_active_milestone } from '../tools/agent-tools.js';
import { discord_reply } from '../tools/discord-tools.js';
import {
  getContextKey,
  getConversationContext,
  addMessage,
} from '../context/conversation-store.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

const MAX_ITERATIONS = 10;

async function getAdditionalContext(): Promise<string | undefined> {
  try {
    const milestone = await team_get_active_milestone();
    if (milestone) {
      return `Active milestone: ${milestone}`;
    }
  } catch (error) {
    console.error('Failed to load additional context:', error);
  }
  return undefined;
}

export interface AgentResult {
  response: string;
  toolsUsed: string[];
  iterations: number;
}

export async function runAgent(
  userMessage: string,
  context: MessageContext
): Promise<AgentResult> {
  // Get context key (threadId if in thread, otherwise channelId)
  const contextKey = getContextKey(context.channelId, context.threadId);

  // Retrieve conversation history
  const history = getConversationContext(contextKey);

  // Store the incoming user message
  addMessage(
    contextKey,
    'user',
    userMessage,
    context.authorId,
    context.author,
    context.images.length > 0 ? context.images : undefined
  );

  // Build conversation history for context
  const historyMessages: ChatCompletionMessageParam[] = history.map((msg) => {
    // Preserve media from prior turns so the model can reference past screenshots
    if (msg.role === 'user' && msg.images?.length) {
      const parts: ChatCompletionContentPart[] = [
        {
          type: 'text',
          text: `[${msg.authorName}]: ${msg.content}`,
        },
        ...msg.images.map((img) => ({
          type: 'image_url' as const,
          image_url: { url: img.url },
        })),
      ];
      return { role: 'user', content: parts };
    }

    return {
      role: msg.role,
      content: `[${msg.authorName}]: ${msg.content}`,
    };
  });

  // Build multimodal content array with text and any attached images
  const userContent: ChatCompletionContentPart[] = [
    {
      type: 'text',
      // Include thread context so the model doesn't try to create a nested thread
      // (Discord does not support threads inside threads).
      text:
        context.threadId
          ? `Message from Discord user @${context.author} in thread ${context.threadId} (parent channel ${context.channelId}):\n\n${userMessage}`
          : `Message from Discord user @${context.author} in channel ${context.channelId}:\n\n${userMessage}`,
    },
  ];

  for (const img of context.images) {
    userContent.push({
      type: 'image_url' as const,
      image_url: { url: img.url },
    });
  }

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPrompt(await getAdditionalContext()),
    },
    ...historyMessages,
    {
      role: 'user',
      content: userContent,
    },
  ];

  const toolsUsed: string[] = [];
  let hasReplied = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      tools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];

    if (!choice.message.tool_calls?.length) {
      return {
        response: choice.message.content || "I couldn't formulate a response.",
        toolsUsed,
        iterations: i + 1,
      };
    }

    const assistantMessage: ChatCompletionAssistantMessageParam = {
      role: 'assistant',
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    };
    messages.push(assistantMessage);

    for (const toolCall of choice.message.tool_calls) {
      const toolName = toolCall.function.name;
      toolsUsed.push(toolName);

      console.log(`Executing tool: ${toolName}`);
      const result = await executeToolCall(toolCall, context);

      if (
        (toolName === 'discord_reply' || toolName === 'discord_reply_thread') &&
        result.success
      ) {
        hasReplied = true;
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  const fallbackResponse = hasReplied
    ? ''
    : "I've reached my reasoning limit. Please try a simpler question.";

  return {
    response: fallbackResponse,
    toolsUsed,
    iterations: MAX_ITERATIONS,
  };
}

export async function handleBotMention(
  message: string,
  context: MessageContext
): Promise<void> {
  if (!message.trim()) {
    await context.message.reply(
      "Hey! I can help with:\n" +
      "• Creating issues for features, bugs, or reviews\n" +
      "• Answering questions about the code or project\n" +
      "• Checking deployment and ticket status\n" +
      "• Seeing what our agents are up to\n\n" +
      "Just tag me with your question!"
    );
    return;
  }

  try {
    if ('sendTyping' in context.message.channel) {
      await context.message.channel.sendTyping();
    }

    const result = await runAgent(message, context);

    console.log(
      `Agent completed in ${result.iterations} iterations, used tools: ${result.toolsUsed.join(', ') || 'none'}`
    );

    // Store assistant response in conversation context
    if (result.response) {
      const contextKey = getContextKey(context.channelId, context.threadId);
      addMessage(
        contextKey,
        'assistant',
        result.response,
        context.client.user?.id ?? 'bot',
        context.client.user?.username ?? 'Bot'
      );
    }

    if (result.response && !result.toolsUsed.includes('discord_reply')) {
      await discord_reply(context, result.response);
    }
  } catch (error) {
    console.error('Agent error:', error);
    await context.message.reply(
      "Sorry, I ran into an issue. Could you try rephrasing that?"
    );
  }
}
