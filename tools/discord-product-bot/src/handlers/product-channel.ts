import type { Client, Message, TextChannel } from 'discord.js';
import { ChannelType } from 'discord.js';
import { handleBotMention } from '../agent/index.js';
import type { ImageAttachment, MessageContext } from '../types.js';
import { classifyIssueType, getIssueTypeEmoji } from '../ticket-flows/issue-classifier.js';
import { isBotThread, registerBotThread, touchBotThread } from '../context/thread-registry.js';
import { addMessage, getContextKey } from '../context/conversation-store.js';
import {
  getActiveSuggestion,
  detectSuggestionResponse,
  processIssueSelection,
} from '../services/suggestion-service.js';
import { config } from '../config.js';
import { getActiveDraft } from '../ticket-flows/flow-controller.js';
import { uploadAttachment, isS3Enabled } from '../services/s3-attachments.js';

const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

function extractImageAttachmentsSync(message: Message): ImageAttachment[] {
  return message.attachments
    .filter(att => att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType))
    .map(att => ({
      url: att.proxyURL,
      name: att.name ?? 'image',
      contentType: att.contentType!,
      width: att.width ?? undefined,
      height: att.height ?? undefined,
    }));
}

/**
 * Extracts image attachments and uploads them to S3 for permanent URLs.
 * The permanent URLs can be used directly in GitHub issues.
 */
async function extractAndUploadImages(message: Message): Promise<ImageAttachment[]> {
  const images = extractImageAttachmentsSync(message);

  if (images.length === 0 || !isS3Enabled()) {
    return images;
  }

  // Upload each image to S3 in parallel
  const uploadResults = await Promise.allSettled(
    images.map(async (img) => {
      try {
        const result = await uploadAttachment(img.url, img.name);
        return { ...img, permanentUrl: result.publicUrl };
      } catch (error) {
        console.error(`[ProductChannel] Failed to upload image ${img.name}:`, error);
        return img; // Return without permanent URL on failure
      }
    })
  );

  return uploadResults.map((result, i) =>
    result.status === 'fulfilled' ? result.value : images[i]
  );
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

    const images = await extractAndUploadImages(message);

    const context: MessageContext = {
      message,
      client,
      author: message.author.username,
      authorId: message.author.id,
      channelId: message.channelId,
      threadId,
      images,
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
      const classification = await classifyIssueType({
        content,
        author: message.author.username,
      });

      if (classification.isTicketWorthy && classification.issueType) {
        const emoji = getIssueTypeEmoji(classification.issueType);
        const threadName = classification.suggestedThreadName.slice(0, 100);

        const thread = await message.startThread({
          name: threadName,
          autoArchiveDuration: 1440,
        });
        registerBotThread(thread.id);

        // Seed thread-specific context with the classifier summary and issue type
        const contextKey = getContextKey(message.channelId, thread.id);
        addMessage(
          contextKey,
          'assistant',
          `Ticket triage: ${classification.reason}\nIssue type: ${classification.issueType} (${classification.confidence} confidence)`,
          client.user?.id ?? 'bot',
          client.user?.username ?? 'Bot'
        );

        // Anchor message with issue type indication
        const anchor = await thread.send(
          `${emoji} Starting a thread for this **${classification.issueType}** request. I'll collect the details we need.`
        );

        const images = await extractAndUploadImages(message);

        const context: MessageContext = {
          message: anchor,
          client,
          author: message.author.username,
          authorId: message.author.id,
          channelId: message.channelId,
          threadId: thread.id,
          images,
          shouldReply: false,
          isThreadCreation: true,
        };

        await handleBotMention(content, context);
        return;
      }
    } catch (error) {
      console.error('Issue classification failed; continuing normally:', error);
    }
  }

  const images = await extractAndUploadImages(message);

  const context: MessageContext = {
    message,
    client,
    author: message.author.username,
    authorId: message.author.id,
    channelId: message.channelId,
    threadId,
    images,
  };

  await handleBotMention(content, context);
}
