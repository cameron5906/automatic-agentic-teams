import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  TextChannel,
  ThreadChannel,
  ChannelType,
  EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { config, validateConfig } from './config';
import { initDatabase, closeDatabase, isOwnedThread, saveOwnedThread } from './context/persistence/sqlite';
import { hydrateFromDatabase } from './context/conversation-store';
import { setDiscordClient } from './tools/discord/servers';
import { handleMention } from './agent';
import * as projectStore from './context/project-store';
import type { MessageContext, Project } from './types';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

function isAdmin(userId: string): boolean {
  return config.discord.adminUserIds.includes(userId);
}

function extractMentionContent(message: Message): string {
  if (!client.user) return message.content;

  let content = message.content;

  const mentionPatterns = [
    new RegExp(`<@!?${client.user.id}>`, 'g'),
  ];

  for (const pattern of mentionPatterns) {
    content = content.replace(pattern, '').trim();
  }

  return content;
}

function isBotMentioned(message: Message): boolean {
  if (!client.user) return false;
  return message.mentions.has(client.user.id);
}

async function isReplyToBot(message: Message): Promise<boolean> {
  if (!message.reference?.messageId) return false;
  if (!client.user) return false;

  try {
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
    return referencedMessage.author.id === client.user.id;
  } catch {
    return false;
  }
}

async function getReplyContext(message: Message): Promise<string | undefined> {
  if (!message.reference?.messageId) return undefined;

  try {
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
    const preview = referencedMessage.content.length > 200
      ? referencedMessage.content.substring(0, 197) + '...'
      : referencedMessage.content;
    return `[Replying to ${referencedMessage.author.displayName ?? referencedMessage.author.username}: "${preview}"]`;
  } catch {
    return undefined;
  }
}

function isInOwnedThread(message: Message): boolean {
  const channel = message.channel;
  if (!channel.isThread()) return false;
  return isOwnedThread(channel.id);
}

interface ShouldRespondResult {
  shouldRespond: boolean;
  mentionedBot: boolean;
  isReplyToBot: boolean;
  isInOwnedThread: boolean;
}

async function shouldRespondToMessage(message: Message): Promise<ShouldRespondResult> {
  const mentionedBot = isBotMentioned(message);
  const replyToBot = await isReplyToBot(message);
  const inOwnedThread = isInOwnedThread(message);

  const shouldRespond = mentionedBot || replyToBot || inOwnedThread;

  return {
    shouldRespond,
    mentionedBot,
    isReplyToBot: replyToBot,
    isInOwnedThread: inOwnedThread,
  };
}

async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) return;

  const responseCheck = await shouldRespondToMessage(message);
  if (!responseCheck.shouldRespond) return;

  const content = extractMentionContent(message);

  if (!content && responseCheck.mentionedBot) {
    await message.reply("Hey! You mentioned me but didn't say anything. How can I help?");
    return;
  }

  if (!content) return;

  const channel = message.channel;
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread
  ) {
    await message.reply("I can only respond in text channels and threads.");
    return;
  }

  const threadId = channel.isThread() ? channel.id : undefined;
  const channelId = channel.isThread()
    ? (channel as ThreadChannel).parentId ?? channel.id
    : channel.id;

  const replyContext = await getReplyContext(message);

  const context: MessageContext = {
    message,
    channel: channel as TextChannel | ThreadChannel,
    threadId,
    channelId,
    authorId: message.author.id,
    authorName: message.author.displayName ?? message.author.username,
    isAdmin: isAdmin(message.author.id),
    mentionedBot: responseCheck.mentionedBot,
    isReplyToBot: responseCheck.isReplyToBot,
    isInOwnedThread: responseCheck.isInOwnedThread,
    replyContext,
  };

  try {
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    const response = await handleMention(content, context);

    if (response.length > 2000) {
      const chunks = splitMessage(response, 2000);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(response);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await message.reply("Sorry, I encountered an error. Please try again.");
  }
}

async function createDiscussionThread(
  channel: TextChannel,
  topic: string,
  starterMessage?: string
): Promise<ThreadChannel | null> {
  try {
    const thread = await channel.threads.create({
      name: topic.length > 100 ? topic.substring(0, 97) + '...' : topic,
      autoArchiveDuration: 1440,
      reason: 'Business Bot discussion thread',
    });

    if (channel.guild) {
      saveOwnedThread(thread.id, channel.id, channel.guild.id, topic);
    }

    if (starterMessage) {
      await thread.send(starterMessage);
    }

    return thread;
  } catch (error) {
    console.error('Failed to create discussion thread:', error);
    return null;
  }
}

function splitMessage(content: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[BusinessBot] Logged in as ${readyClient.user.tag}`);

  try {
    initDatabase();
    console.log('[BusinessBot] Database initialized');

    hydrateFromDatabase();
    console.log('[BusinessBot] Conversation context hydrated');

    setDiscordClient(client);
    console.log('[BusinessBot] Discord client registered for tools');
  } catch (error) {
    console.error('[BusinessBot] Initialization error:', error);
  }

  console.log('[BusinessBot] Ready to accept messages');
  console.log(`[BusinessBot] Admin users: ${config.discord.adminUserIds.join(', ') || 'None configured'}`);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await handleMessage(message);
  } catch (error) {
    console.error('[BusinessBot] Message handler error:', error);
  }
});

function buildProductBotOnboardingEmbed(project: Project): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('Project Onboarding')
    .setDescription(
      `**${project.name}**\n\n` +
      (project.description ?? 'A new automated development project.')
    );

  if (project.planning.businessPlan) {
    const planPreview = project.planning.businessPlan.length > 800
      ? project.planning.businessPlan.substring(0, 797) + '...'
      : project.planning.businessPlan;
    embed.addFields({
      name: 'Business Plan',
      value: planPreview,
    });
  }

  if (project.planning.ideas.length > 0) {
    embed.addFields({
      name: 'Key Ideas',
      value: project.planning.ideas.slice(0, 5).map((idea) => `• ${idea}`).join('\n'),
    });
  }

  if (project.resources.github) {
    embed.addFields({
      name: 'Repository',
      value: `[${project.resources.github.owner}/${project.resources.github.repo}](${project.resources.github.url})`,
      inline: true,
    });
  }

  if (project.resources.domain) {
    embed.addFields({
      name: 'Domain',
      value: project.resources.domain.name,
      inline: true,
    });
  }

  embed.addFields({
    name: 'Instructions',
    value:
      'Please begin setting up the **initial boilerplate** for this project based on the plan above. ' +
      'Focus only on what has been explicitly planned—do not expand scope or add features beyond the current plan. ' +
      'Create the foundational structure and any agreed-upon initial components, but wait for further direction before going deeper.',
  });

  embed.setFooter({ text: 'Powered by github-auto-team' }).setTimestamp();

  return embed;
}

async function handleProductBotJoin(member: GuildMember): Promise<void> {
  const productBotClientId = config.discord.productBotClientId;
  if (!productBotClientId) return;

  if (member.user.id !== productBotClientId) return;

  console.log(`[BusinessBot] Product Bot joined server: ${member.guild.name}`);

  const projects = projectStore.listProjects();
  const project = projects.find(
    (p) => p.resources.discord?.serverId === member.guild.id
  );

  if (!project) {
    console.log(`[BusinessBot] No project found for server ${member.guild.id}`);
    return;
  }

  const productChannel = member.guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildText && ch.name === 'product'
  ) as TextChannel | undefined;

  if (!productChannel) {
    console.log(`[BusinessBot] No #product channel found in ${member.guild.name}`);
    return;
  }

  try {
    const embed = buildProductBotOnboardingEmbed(project);

    await productChannel.send({
      content: `Hey <@${productBotClientId}>! Welcome to the team. Here's the project brief:`,
      embeds: [embed],
    });

    console.log(`[BusinessBot] Sent onboarding message to Product Bot in ${member.guild.name}`);
  } catch (error) {
    console.error('[BusinessBot] Failed to send Product Bot onboarding:', error);
  }
}

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await handleProductBotJoin(member);
  } catch (error) {
    console.error('[BusinessBot] GuildMemberAdd handler error:', error);
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[BusinessBot] Received ${signal}, shutting down gracefully...`);

  try {
    closeDatabase();
    console.log('[BusinessBot] Database closed');
  } catch (error) {
    console.error('[BusinessBot] Error closing database:', error);
  }

  try {
    client.destroy();
    console.log('[BusinessBot] Discord client destroyed');
  } catch (error) {
    console.error('[BusinessBot] Error destroying client:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('[BusinessBot] Starting...');

try {
  validateConfig();
  console.log('[BusinessBot] Configuration validated');
} catch (error) {
  console.error('[BusinessBot] Configuration error:', error);
  process.exit(1);
}

client.login(config.discord.token).catch((error) => {
  console.error('[BusinessBot] Failed to login:', error);
  process.exit(1);
});
