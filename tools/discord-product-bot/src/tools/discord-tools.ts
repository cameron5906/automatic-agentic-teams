import type { Message, ThreadChannel, TextChannel } from 'discord.js';
import type { MessageContext, ThreadInfo, ToolResult } from '../types.js';
import { registerBotThread, touchBotThread } from '../context/thread-registry.js';
import { getDraftByThread, setDraftMessageId } from '../ticket-flows/draft-store.js';
import { getDraftFormattedWithEmbeds } from '../ticket-flows/flow-controller.js';

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

/**
 * Posts or updates the draft message in the current thread using rich embeds.
 * If no draft message exists, posts a new one and stores its ID.
 * If a draft message exists, edits it in place.
 *
 * The content parameter is ignored - we always generate the embed from the draft.
 */
export async function discord_post_draft_message(
  context: MessageContext,
  _content: string
): Promise<ToolResult> {
  if (!context.threadId) {
    return { success: false, error: 'Not in a thread.' };
  }

  const draft = getDraftByThread(context.threadId);
  if (!draft) {
    return { success: false, error: 'No active draft in this thread.' };
  }

  const formatted = getDraftFormattedWithEmbeds(context.threadId);
  if (!formatted) {
    return { success: false, error: 'Failed to format draft.' };
  }

  const channel = context.message.channel;
  if (!('send' in channel)) {
    return { success: false, error: 'Cannot send messages in this channel.' };
  }

  const messagePayload = {
    content: formatted.content || undefined,
    embeds: formatted.embeds,
  };

  try {
    if (draft.draftMessageId) {
      // Edit existing draft message with new embed
      const existingMessage = await channel.messages.fetch(draft.draftMessageId);
      if (existingMessage) {
        await existingMessage.edit(messagePayload);
        return {
          success: true,
          data: {
            messageId: draft.draftMessageId,
            action: 'updated',
            isComplete: formatted.isComplete,
          },
        };
      }
    }

    // Post new draft message with embed
    const message = await (channel as TextChannel).send(messagePayload);
    setDraftMessageId(context.threadId, message.id);

    return {
      success: true,
      data: {
        messageId: message.id,
        action: 'created',
        isComplete: formatted.isComplete,
      },
    };
  } catch (error) {
    // If we failed to edit (message deleted?), try posting a new one
    if (draft.draftMessageId) {
      try {
        const message = await (channel as TextChannel).send(messagePayload);
        setDraftMessageId(context.threadId, message.id);
        return {
          success: true,
          data: {
            messageId: message.id,
            action: 'created_after_edit_failed',
            isComplete: formatted.isComplete,
          },
        };
      } catch (sendError) {
        return {
          success: false,
          error: `Failed to post draft message: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
        };
      }
    }

    return {
      success: false,
      error: `Failed to post draft message: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Replies to the draft message in the current thread.
 * This is used to notify the user about updates without spamming new messages.
 */
export async function discord_reply_to_draft(
  context: MessageContext,
  content: string
): Promise<ToolResult> {
  if (!context.threadId) {
    return { success: false, error: 'Not in a thread.' };
  }

  const draft = getDraftByThread(context.threadId);
  if (!draft) {
    return { success: false, error: 'No active draft in this thread.' };
  }

  if (!draft.draftMessageId) {
    return { success: false, error: 'No draft message to reply to. Post the draft message first.' };
  }

  const channel = context.message.channel;
  if (!('send' in channel)) {
    return { success: false, error: 'Cannot send messages in this channel.' };
  }

  try {
    const draftMessage = await channel.messages.fetch(draft.draftMessageId);
    if (!draftMessage) {
      return { success: false, error: 'Draft message not found. It may have been deleted.' };
    }

    await draftMessage.reply(content);
    return { success: true, data: { repliedTo: draft.draftMessageId } };
  } catch (error) {
    // If draft message was deleted, fall back to regular send
    try {
      await (channel as TextChannel).send(content);
      return { success: true, data: { fallback: true } };
    } catch (sendError) {
      return {
        success: false,
        error: `Failed to reply: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
