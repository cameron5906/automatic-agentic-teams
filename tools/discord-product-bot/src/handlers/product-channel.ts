import type { Client, Message, ThreadChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import { handleBotMention } from '../agent/index.js';
import type { ImageAttachment, MessageContext } from '../types.js';
import { classifyTicketWorthiness } from '../services/ticket-classifier.js';
import { isBotThread, registerBotThread, touchBotThread } from '../context/thread-registry.js';
import { addMessage, getContextKey } from '../context/conversation-store.js';

const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

function extractImageAttachments(message: Message): ImageAttachment[] {
  return message.attachments
    .filter(att => att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType))
    .map(att => ({
      url: att.url,
      name: att.name ?? 'image',
      contentType: att.contentType!,
      width: att.width ?? undefined,
      height: att.height ?? undefined,
    }));
}

function extractThreadId(message: Message): string | null {
  const channel = message.channel;
  if (
    channel.type === ChannelType.PublicThread ||
    channel.type === ChannelType.PrivateThread
  ) {
    return channel.id;
  }
  return null;
}

export async function handleProductMessage(
  message: Message,
  client: Client
): Promise<void> {
  if (message.author.bot) return;

  const threadId = extractThreadId(message);
  const botMentioned = message.mentions.users.has(client.user!.id);

  // In bot-created threads, we auto-handle follow-ups without requiring a mention.
  if (threadId && isBotThread(threadId)) {
    const content = message.content
      .replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '')
      .trim();

    const context: MessageContext = {
      message,
      client,
      author: message.author.username,
      authorId: message.author.id,
      channelId: message.channelId,
      threadId,
      images: extractImageAttachments(message),
    };

    touchBotThread(threadId);
    await handleBotMention(content, context);
    return;
  }

  // Outside bot-owned threads, only respond when explicitly mentioned.
  if (!botMentioned) return;

  const content = message.content
    .replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '')
    .trim();

  // If this looks ticket-worthy and we're not already in a thread, create a thread
  // and continue *only* inside it (GitHub is the team's primary comms surface).
  if (!threadId) {
    try {
      const classification = await classifyTicketWorthiness({
        content,
        author: message.author.username,
      });

      if (classification.isTicketWorthy) {
        const thread = await message.startThread({
          name: classification.suggestedThreadName.slice(0, 100),
          autoArchiveDuration: 1440,
        });
        registerBotThread(thread.id);

        // Seed thread-specific context with the classifier summary so we retain intent
        // even as the main channel moves on.
        const contextKey = getContextKey(message.channelId, thread.id);
        addMessage(
          contextKey,
          'assistant',
          `Ticket triage: ${classification.reason}`,
          client.user?.id ?? 'bot',
          client.user?.username ?? 'Bot'
        );

        // Anchor message ensures that any `discord_reply` tool call replies in-thread,
        // not in the main channel.
        const anchor = await thread.send(
          `Starting a thread for this ticketable request. We'll continue here.`
        );

        const context: MessageContext = {
          message: anchor,
          client,
          author: message.author.username,
          authorId: message.author.id,
          channelId: message.channelId,
          threadId: thread.id,
          images: extractImageAttachments(message),
          shouldReply: false,
        };

        await handleBotMention(content, context);
        return;
      }
    } catch (error) {
      console.error('Ticket-worthiness classification failed; continuing normally:', error);
    }
  }

  const context: MessageContext = {
    message,
    client,
    author: message.author.username,
    authorId: message.author.id,
    channelId: message.channelId,
    threadId,
    images: extractImageAttachments(message),
  };

  await handleBotMention(content, context);
}
