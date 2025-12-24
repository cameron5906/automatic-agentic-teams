import type { Message, ThreadChannel, TextChannel } from 'discord.js';
import type { MessageContext, ThreadInfo } from '../types.js';
import { registerBotThread, touchBotThread } from '../context/thread-registry.js';

export async function discord_reply(
  context: MessageContext,
  content: string
): Promise<void> {
  if (context.shouldReply === false && 'send' in context.message.channel) {
    await (context.message.channel as any).send(content);
  } else {
    await context.message.reply(content);
  }
}

export async function discord_react(
  context: MessageContext,
  emoji: string
): Promise<void> {
  try {
    await context.message.react(emoji);
  } catch (error) {
    console.error(`Failed to react with ${emoji}:`, error);
  }
}

export async function discord_create_thread(
  context: MessageContext,
  name: string,
  initialMessage?: string
): Promise<ThreadInfo> {
  // NOTE: Discord does not allow creating "threads within threads". In practice, the
  // product-channel handler will often already have moved the conversation into a
  // thread before the LLM responds. If the model still calls this tool, treat it as
  // "ensure we're in a thread" rather than failing noisily and confusing users.
  const currentChannel = context.message.channel;
  if ('isThread' in currentChannel && currentChannel.isThread()) {
    if (initialMessage) {
      await currentChannel.send(initialMessage);
    }

    // Keep the registry warm as the thread is actively used.
    touchBotThread(currentChannel.id);

    return {
      id: currentChannel.id,
      name: currentChannel.name,
    };
  }

  const thread = await context.message.startThread({
    name: name.slice(0, 100),
    autoArchiveDuration: 1440,
  });

  // Record bot-created threads so we can auto-handle follow-ups without @mentions.
  registerBotThread(thread.id);

  if (initialMessage) {
    await thread.send(initialMessage);
  }

  return {
    id: thread.id,
    name: thread.name,
  };
}

export async function discord_reply_thread(
  context: MessageContext,
  threadId: string,
  content: string
): Promise<void> {
  const thread = await context.client.channels.fetch(threadId);
  if (thread && thread.isThread()) {
    await thread.send(content);
    // Keep the registry warm as the thread is actively used.
    touchBotThread(threadId);
  } else {
    throw new Error(`Thread ${threadId} not found or is not a thread`);
  }
}
