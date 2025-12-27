import type { Client, Message, ThreadChannel, TextChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import { handleBotMention } from '../agent/index.js';
import type { ImageAttachment, MessageContext } from '../types.js';
import { classifyTicketWorthiness } from '../services/ticket-classifier.js';
import { isBotThread, registerBotThread, touchBotThread } from '../context/thread-registry.js';
import { addMessage, getContextKey } from '../context/conversation-store.js';
import {
  getActiveSuggestion,
  detectSuggestionResponse,
  processIssueSelection,
} from '../services/suggestion-service.js';
import { config } from '../config.js';

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

/**
 * Counts messages between a reference message and the current message.
 * Used to assess likelihood that a message is responding to a suggestion.
 */
async function countMessagesSince(
  channel: TextChannel,
  referenceMessageId: string,
  currentMessageId: string
): Promise<number> {
  try {
    // Fetch messages after the reference message
    const messages = await channel.messages.fetch({
      after: referenceMessageId,
      limit: 20,
    });
    
    // Count messages that came before the current message
    let count = 0;
    for (const [id] of messages) {
      if (id === currentMessageId) break;
      count++;
    }
    
    return count;
  } catch (error) {
    console.error('[ProductChannel] Error counting messages:', error);
    return 0;
  }
}

/**
 * Checks if a message is responding to a pending issue suggestion.
 * Returns true if the message was handled as a suggestion response.
 */
async function checkForSuggestionResponse(
  message: Message,
  client: Client
): Promise<boolean> {
  // Only check messages from the team lead
  if (message.author.id !== config.discord.teamLeadUserId) {
    return false;
  }

  // Check for pending suggestion
  const suggestion = getActiveSuggestion();
  if (!suggestion) {
    return false;
  }

  const content = message.content.trim();
  if (!content) {
    return false;
  }

  // Count messages since the suggestion
  const channel = message.channel as TextChannel;
  const messageDistance = await countMessagesSince(
    channel,
    suggestion.messageId,
    message.id
  );

  console.log(
    `[ProductChannel] Checking message for suggestion response (distance: ${messageDistance})`
  );

  // Use GPT to detect if this is a response
  const detection = await detectSuggestionResponse(
    content,
    suggestion,
    messageDistance
  );

  console.log(
    `[ProductChannel] Detection result: isResponse=${detection.isResponse}, ` +
    `selectedIssue=${detection.selectedIssue}, confidence=${detection.confidence}`
  );

  // Only process high/medium confidence responses
  if (
    detection.isResponse &&
    detection.selectedIssue !== null &&
    (detection.confidence === 'high' || detection.confidence === 'medium')
  ) {
    await processIssueSelection(client, suggestion, detection.selectedIssue);
    return true;
  }

  return false;
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

  // Outside bot-owned threads, check for ambient suggestion responses before requiring mention
  if (!botMentioned) {
    // Only check for suggestion responses in the main product channel (not threads)
    if (!threadId) {
      const handled = await checkForSuggestionResponse(message, client);
      if (handled) return;
    }
    return;
  }

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
          // Signal that this is thread creation - agent should consolidate to one message
          isThreadCreation: true,
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
