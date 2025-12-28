import { Client, ChannelType, GuildDefaultMessageNotifications, EmbedBuilder, PermissionFlagsBits, type Guild, type TextChannel, type ThreadChannel } from 'discord.js';
import type { ToolResult, Project } from '../../types';
import * as projectStore from '../../context/project-store';
import { saveOwnedThread } from '../../context/persistence/sqlite';
import { config } from '../../config';

const PRODUCT_BOT_PERMISSIONS = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.SendMessagesInThreads,
].reduce((acc, perm) => acc | perm, 0n);

function buildProductBotInviteUrl(serverId: string): string | null {
  const clientId = config.discord.productBotClientId;
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    permissions: PRODUCT_BOT_PERMISSIONS.toString(),
    scope: 'bot applications.commands',
    guild_id: serverId,
    disable_guild_select: 'true',
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  discordClient = client;
}

function getClient(): Client {
  if (!discordClient) {
    throw new Error('Discord client not initialized');
  }
  return discordClient;
}

function checkGuildPermissions(
  guild: Guild,
  required: bigint[]
): { hasPermission: boolean; missing: string[] } {
  const me = guild.members.me;
  if (!me) {
    return { hasPermission: false, missing: ['Bot not in guild'] };
  }

  const missing: string[] = [];
  for (const perm of required) {
    if (!me.permissions.has(perm)) {
      const permName = Object.entries(PermissionFlagsBits).find(
        ([, value]) => value === perm
      )?.[0];
      missing.push(permName ?? 'Unknown');
    }
  }

  return { hasPermission: missing.length === 0, missing };
}

export async function listServers(): Promise<ToolResult> {
  try {
    const client = getClient();
    const guilds = client.guilds.cache;

    const servers = guilds.map((guild) => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      ownerId: guild.ownerId,
      createdAt: guild.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        count: servers.length,
        servers,
        summary: `Bot is in ${servers.length} server(s)`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list servers',
    };
  }
}

export async function getServer(serverId: string): Promise<ToolResult> {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
      };
    }

    const channels = guild.channels.cache.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ChannelType[ch.type],
    }));

    return {
      success: true,
      data: {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        channels,
        createdAt: guild.createdAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get server',
    };
  }
}

export async function createServer(
  name: string,
  projectId: string,
  hasApproval = false
): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  if (!hasApproval && !projectStore.hasApproval(projectId, 'discord')) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt: `I'd like to create a new Discord server called **${name}**. Do you approve?`,
      error: 'Discord server creation requires human approval',
    };
  }

  try {
    const client = getClient();

    const guild = await client.guilds.create({
      name,
      defaultMessageNotifications: GuildDefaultMessageNotifications.OnlyMentions,
    });

    projectStore.setDiscordResource(projectId, {
      serverId: guild.id,
      serverName: guild.name,
      channels: [],
    });

    return {
      success: true,
      data: {
        id: guild.id,
        name: guild.name,
        message: `Created Discord server: ${guild.name}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create server',
    };
  }
}

function buildWelcomeEmbed(project: Project | null, serverName: string, serverId: string): EmbedBuilder {
  const productBotInviteUrl = buildProductBotInviteUrl(serverId);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`Welcome to ${serverName}!`)
    .setDescription(
      project?.description
        ? `**${project.name}**\n\n${project.description}`
        : `This server was created to support an automated development project.`
    )
    .addFields(
      {
        name: '🤖 How This Works',
        value:
          'This project is powered by an **AI agent team** that collaborates to build software. ' +
          'When issues are created in GitHub, specialized agents work together to implement features, ' +
          'fix bugs, and maintain code quality.',
      },
      {
        name: '👥 The Agent Team',
        value: [
          '• **Tech Lead** - Architecture decisions and engineer guidance',
          '• **Software Engineer** - Code implementation',
          '• **Product Owner** - Feature alignment and acceptance criteria',
          '• **Test Engineer** - Test coverage verification',
          '• **Code Reviewer** - PR validation and quality gate',
          '• **Security Engineer** - Security review and OWASP compliance',
          '• **Documentation Sheriff** - Docs integrity and updates',
          '• **Infrastructure Engineer** - AWS/CDK infrastructure',
          '• **UX Designer** - User flows and accessibility',
          '• **Project Manager** - Milestone tracking and coordination',
        ].join('\n'),
      },
      {
        name: '📢 Channel Guide',
        value: [
          '• **#general** - General discussion and announcements',
          '• **#standup** - Daily standups and status updates',
          '• **#product** - Product discussions and feature requests',
          '• **#dev** - Technical discussions and agent updates',
          '• **#pull-requests** - PR notifications and reviews',
        ].join('\n'),
      }
    );

  if (productBotInviteUrl) {
    embed.addFields({
      name: '🔗 Add the Product Bot',
      value:
        'To enable full project management features, add the **Product Bot** to this server:\n' +
        `**[Click here to add Product Bot](${productBotInviteUrl})**\n\n` +
        'The Product Bot handles:\n' +
        '• Issue creation from Discord discussions\n' +
        '• PR notifications and approval workflows\n' +
        '• Agent status updates and monitoring\n' +
        '• Team coordination and notifications',
    });
  }

  embed.addFields({
    name: '🚀 Getting Started',
    value:
      'Create issues in the GitHub repository to kick off work. ' +
      'The agent team will pick them up and you\'ll see updates here in Discord as they progress. ' +
      'Feel free to discuss ideas in #product or technical details in #dev!',
  });

  embed.setFooter({ text: 'Powered by github-auto-team' }).setTimestamp();

  if (project?.planning.businessPlan) {
    embed.addFields({
      name: '📋 Business Plan',
      value: project.planning.businessPlan.length > 500
        ? project.planning.businessPlan.substring(0, 497) + '...'
        : project.planning.businessPlan,
    });
  }

  return embed;
}

export async function setupChannels(serverId: string): Promise<ToolResult> {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
      };
    }

    const permCheck = checkGuildPermissions(guild, [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageWebhooks,
    ]);
    if (!permCheck.hasPermission) {
      return {
        success: false,
        error: `Missing permissions: ${permCheck.missing.join(', ')}`,
      };
    }

    const channelNames = ['standup', 'product', 'dev', 'pull-requests'];
    const createdChannels: string[] = [];
    const channelIds: Record<string, string> = {};
    const webhooks: Record<string, string> = {};

    let category = guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === 'project'
    );

    if (!category) {
      category = await guild.channels.create({
        name: 'Project',
        type: ChannelType.GuildCategory,
      });
    }

    for (const name of channelNames) {
      let channel = guild.channels.cache.find(
        (ch) => ch.type === ChannelType.GuildText && ch.name === name
      ) as TextChannel | undefined;

      if (!channel) {
        channel = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: category.id,
        }) as TextChannel;
        createdChannels.push(name);
      }

      channelIds[name] = channel.id;

      if (['product', 'dev', 'pull-requests'].includes(name)) {
        try {
          const webhook = await channel.createWebhook({
            name: `${guild.name} - ${name}`,
            reason: 'Auto-created for CI/CD pipeline notifications',
          });
          webhooks[name] = webhook.url;
        } catch (webhookError) {
          console.error(`Failed to create webhook for #${name}:`, webhookError);
        }
      }
    }

    const projects = projectStore.listProjects();
    const matchingProject = projects.find(
      (p) => p.resources.discord?.serverId === serverId
    );

    if (matchingProject) {
      projectStore.setDiscordResource(matchingProject.id, {
        serverId,
        serverName: guild.name,
        channels: channelNames,
        channelIds,
        webhooks,
      });
    }

    let generalChannel = guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name === 'general'
    ) as TextChannel | undefined;

    if (!generalChannel) {
      generalChannel = await guild.channels.create({
        name: 'general',
        type: ChannelType.GuildText,
      }) as TextChannel;
    }

    channelIds['general'] = generalChannel.id;

    if (generalChannel) {
      const welcomeEmbed = buildWelcomeEmbed(matchingProject ?? null, guild.name, serverId);
      await generalChannel.send({ embeds: [welcomeEmbed] });
    }

    return {
      success: true,
      data: {
        serverId,
        createdChannels,
        allChannels: [...channelNames, 'general'],
        channelIds,
        webhooks: {
          product: webhooks['product'] ? '✓ Created' : '✗ Failed',
          dev: webhooks['dev'] ? '✓ Created' : '✗ Failed',
          'pull-requests': webhooks['pull-requests'] ? '✓ Created' : '✗ Failed',
        },
        webhooksReady: Object.keys(webhooks).length === 3,
        welcomeMessageSent: true,
        message: createdChannels.length > 0
          ? `Created channels: ${createdChannels.join(', ')}. Webhooks created for product, dev, and pull-requests. Welcome message posted in #general.`
          : 'All standard channels already exist. Webhooks created. Welcome message posted in #general.',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to setup channels',
    };
  }
}

export async function createWebhook(
  serverId: string,
  channelName: string,
  webhookName?: string
): Promise<ToolResult> {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
      };
    }

    const permCheck = checkGuildPermissions(guild, [
      PermissionFlagsBits.ManageWebhooks,
    ]);
    if (!permCheck.hasPermission) {
      return {
        success: false,
        error: `Missing permissions: ${permCheck.missing.join(', ')}`,
      };
    }

    const channel = guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText && ch.name === channelName
    ) as TextChannel | undefined;

    if (!channel) {
      return {
        success: false,
        error: `Channel #${channelName} not found in server`,
      };
    }

    const webhook = await channel.createWebhook({
      name: webhookName ?? `${guild.name} - ${channelName}`,
      reason: 'Created by Business Bot for CI/CD pipeline',
    });

    const projects = projectStore.listProjects();
    const matchingProject = projects.find(
      (p) => p.resources.discord?.serverId === serverId
    );

    if (matchingProject && matchingProject.resources.discord) {
      const existingWebhooks = matchingProject.resources.discord.webhooks ?? {};
      projectStore.setDiscordResource(matchingProject.id, {
        ...matchingProject.resources.discord,
        webhooks: {
          ...existingWebhooks,
          [channelName]: webhook.url,
        },
      });
    }

    return {
      success: true,
      data: {
        channelId: channel.id,
        channelName,
        webhookId: webhook.id,
        webhookUrl: webhook.url,
        message: `Created webhook for #${channelName}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create webhook',
    };
  }
}

export async function getChannelIds(serverId: string): Promise<ToolResult> {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
      };
    }

    const channelIds: Record<string, string> = {};
    const targetChannels = ['general', 'standup', 'product', 'dev', 'pull-requests'];

    for (const name of targetChannels) {
      const channel = guild.channels.cache.find(
        (ch) => ch.type === ChannelType.GuildText && ch.name === name
      );
      if (channel) {
        channelIds[name] = channel.id;
      }
    }

    return {
      success: true,
      data: {
        serverId,
        serverName: guild.name,
        channelIds,
        message: `Found ${Object.keys(channelIds).length} channel IDs`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get channel IDs',
    };
  }
}

export async function inviteUsers(
  serverId: string,
  options: {
    userIds?: string[];
    maxUses?: number;
    maxAge?: number;
  } = {}
): Promise<ToolResult> {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
      };
    }

    const permCheck = checkGuildPermissions(guild, [
      PermissionFlagsBits.CreateInstantInvite,
    ]);
    if (!permCheck.hasPermission) {
      return {
        success: false,
        error: `Missing permissions: ${permCheck.missing.join(', ')}`,
      };
    }

    const channel = guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildText
    );

    if (!channel || channel.type !== ChannelType.GuildText) {
      return {
        success: false,
        error: 'No text channel found for invite',
      };
    }

    const invite = await channel.createInvite({
      maxUses: options.maxUses ?? 0,
      maxAge: options.maxAge ?? 0,
      unique: true,
    });

    const projects = projectStore.listProjects();
    const matchingProject = projects.find(
      (p) => p.resources.discord?.serverId === serverId
    );

    if (matchingProject && matchingProject.resources.discord) {
      projectStore.setDiscordResource(matchingProject.id, {
        ...matchingProject.resources.discord,
        inviteUrl: invite.url,
      });
    }

    return {
      success: true,
      data: {
        inviteUrl: invite.url,
        inviteCode: invite.code,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt?.toISOString(),
        message: `Created invite: ${invite.url}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invite',
    };
  }
}

export async function deleteServer(
  serverId: string,
  hasApproval = false
): Promise<ToolResult> {
  if (!hasApproval) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt: `⚠️ **DANGER**: I'm about to permanently delete the Discord server **${serverId}**. This cannot be undone! Do you approve?`,
      error: 'Discord server deletion requires human approval',
    };
  }

  try {
    const client = getClient();
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
      };
    }

    const serverName = guild.name;
    await guild.delete();

    return {
      success: true,
      data: {
        serverId,
        serverName,
        message: `Deleted Discord server: ${serverName}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete server',
    };
  }
}

export async function createChannel(
  serverId: string,
  name: string,
  options: {
    type?: 'text' | 'voice' | 'category';
    categoryId?: string;
  } = {}
): Promise<ToolResult> {
  try {
    const client = getClient();
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return {
        success: false,
        error: `Server ${serverId} not found`,
      };
    }

    const permCheck = checkGuildPermissions(guild, [
      PermissionFlagsBits.ManageChannels,
    ]);
    if (!permCheck.hasPermission) {
      return {
        success: false,
        error: `Missing permissions: ${permCheck.missing.join(', ')}`,
      };
    }

    const channelTypeMap: Record<string, ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory> = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory,
    };
    const channelType = channelTypeMap[options.type ?? 'text'];

    const channel = await guild.channels.create({
      name,
      type: channelType,
      parent: options.categoryId,
    });

    return {
      success: true,
      data: {
        id: channel.id,
        name: channel.name,
        type: options.type ?? 'text',
        message: `Created channel: #${channel.name}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create channel',
    };
  }
}

export async function createThread(
  channel: TextChannel,
  topic: string,
  starterMessage?: string
): Promise<ToolResult> {
  try {
    const permCheck = checkGuildPermissions(channel.guild, [
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.SendMessagesInThreads,
    ]);
    if (!permCheck.hasPermission) {
      return {
        success: false,
        error: `Missing permissions: ${permCheck.missing.join(', ')}`,
      };
    }

    const threadName = topic.length > 100 ? topic.substring(0, 97) + '...' : topic;

    const thread = await channel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: 'Business Bot discussion thread',
    });

    saveOwnedThread(thread.id, channel.id, channel.guild.id, topic);

    if (starterMessage) {
      await thread.send(starterMessage);
    }

    return {
      success: true,
      data: {
        threadId: thread.id,
        threadName: thread.name,
        channelId: channel.id,
        message: `Created discussion thread: "${thread.name}". I'll automatically respond to all messages in this thread.`,
        threadUrl: `https://discord.com/channels/${channel.guild.id}/${thread.id}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create thread',
    };
  }
}
