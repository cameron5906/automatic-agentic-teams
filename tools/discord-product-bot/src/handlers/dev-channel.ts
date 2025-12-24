import type { Client, Message, TextChannel } from 'discord.js';
import { config } from '../config.js';
import { createProductUpdate } from '../services/openai.js';

const MERGE_KEYWORDS = ['merged', 'merge', 'shipped', 'deployed', 'released', 'feature'];

export async function handleDevMessage(
  message: Message,
  client: Client
): Promise<void> {
  if (message.author.id !== client.user!.id) return;

  const content = message.content.toLowerCase();
  const hasMergeKeyword = MERGE_KEYWORDS.some((keyword) => content.includes(keyword));
  if (!hasMergeKeyword) return;

  try {
    const updateResult = await createProductUpdate(message.content);

    if (!updateResult.shouldPost) {
      console.log('Dev message not significant enough for product update:', message.content.slice(0, 100));
      return;
    }

    const productChannel = await client.channels.fetch(config.discord.productChannelId);
    if (!productChannel || !productChannel.isTextBased()) {
      console.error('Product channel not found or not text-based');
      return;
    }

    await (productChannel as TextChannel).send(`**Product Update** ${updateResult.update}`);
    console.log('Posted product update:', updateResult.update);
  } catch (error) {
    console.error('Error handling dev message:', error);
  }
}
