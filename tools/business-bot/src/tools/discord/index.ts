import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const discordTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'discord_create_server',
      description: 'Create a new Discord server. REQUIRES HUMAN APPROVAL.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Server name',
          },
          projectId: {
            type: 'string',
            description: 'Project ID to associate with this server',
          },
        },
        required: ['name', 'projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_setup_channels',
      description: 'Set up the standard channel structure in a Discord server (standup, product, dev, pull-requests)',
      parameters: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Discord server ID',
          },
        },
        required: ['serverId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_invite_users',
      description: 'Generate an invite link for a Discord server or invite specific users',
      parameters: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Discord server ID',
          },
          userIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of Discord user IDs to invite',
          },
          maxUses: {
            type: 'number',
            description: 'Maximum number of uses for the invite (0 = unlimited)',
          },
          maxAge: {
            type: 'number',
            description: 'Invite expiration in seconds (0 = never)',
          },
        },
        required: ['serverId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_delete_server',
      description: 'Delete a Discord server. REQUIRES HUMAN APPROVAL. This is irreversible!',
      parameters: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Discord server ID to delete',
          },
        },
        required: ['serverId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_list_servers',
      description: 'List all Discord servers the bot is a member of',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_get_server',
      description: 'Get information about a specific Discord server',
      parameters: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Discord server ID',
          },
        },
        required: ['serverId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_create_channel',
      description: 'Create a new channel in a Discord server',
      parameters: {
        type: 'object',
        properties: {
          serverId: {
            type: 'string',
            description: 'Discord server ID',
          },
          name: {
            type: 'string',
            description: 'Channel name',
          },
          type: {
            type: 'string',
            enum: ['text', 'voice', 'category'],
            description: 'Channel type (default: text)',
          },
          categoryId: {
            type: 'string',
            description: 'Optional category ID to place the channel in',
          },
        },
        required: ['serverId', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_create_thread',
      description: 'Create a discussion thread in the current channel for in-depth conversation. The bot will automatically respond to all messages in threads it creates.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic/title for the thread (max 100 characters)',
          },
          starterMessage: {
            type: 'string',
            description: 'Optional first message to post in the thread',
          },
        },
        required: ['topic'],
      },
    },
  },
];
