import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const githubTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'github_list_repos',
      description: 'List repositories in the configured organization/account',
      parameters: {
        type: 'object',
        properties: {
          org: {
            type: 'string',
            description: 'Optional organization to list repos from (defaults to configured org)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_get_repo',
      description: 'Get detailed information about a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (user or org)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_repo',
      description: 'Create a new repository. REQUIRES HUMAN APPROVAL.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Repository name',
          },
          description: {
            type: 'string',
            description: 'Repository description',
          },
          isPrivate: {
            type: 'boolean',
            description: 'Whether the repo is private (default: true)',
          },
          projectId: {
            type: 'string',
            description: 'Project ID to associate with this repo',
          },
        },
        required: ['name', 'projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_repo_from_template',
      description: 'Create a new repository from the configured template (automatic-agentic-teams). This is the PREFERRED method for new projects as it sets up the full agent pipeline. REQUIRES HUMAN APPROVAL.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Repository name for the new project',
          },
          description: {
            type: 'string',
            description: 'Repository description',
          },
          isPrivate: {
            type: 'boolean',
            description: 'Whether the repo is private (default: true)',
          },
          projectId: {
            type: 'string',
            description: 'Project ID to associate with this repo',
          },
        },
        required: ['name', 'projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_fork_repo',
      description: 'Fork an existing repository. Use github_create_repo_from_template for new projects instead. REQUIRES HUMAN APPROVAL.',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Owner of the repo to fork',
          },
          repo: {
            type: 'string',
            description: 'Name of the repo to fork',
          },
          newName: {
            type: 'string',
            description: 'New name for the forked repo',
          },
          projectId: {
            type: 'string',
            description: 'Project ID to associate with this repo',
          },
        },
        required: ['owner', 'repo', 'projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_delete_repo',
      description: 'Delete a repository. REQUIRES HUMAN APPROVAL. This is irreversible!',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_update_repo',
      description: 'Update repository settings',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          name: {
            type: 'string',
            description: 'New repository name',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          homepage: {
            type: 'string',
            description: 'Homepage URL',
          },
          isPrivate: {
            type: 'boolean',
            description: 'Whether the repo is private',
          },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_file',
      description: 'Create or update a file in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          path: {
            type: 'string',
            description: 'File path in the repository',
          },
          content: {
            type: 'string',
            description: 'File content',
          },
          message: {
            type: 'string',
            description: 'Commit message',
          },
          branch: {
            type: 'string',
            description: 'Branch name (optional)',
          },
        },
        required: ['owner', 'repo', 'path', 'content', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_get_file',
      description: 'Get the content of a file from a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          path: {
            type: 'string',
            description: 'File path in the repository',
          },
          ref: {
            type: 'string',
            description: 'Branch, tag, or commit SHA (optional)',
          },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_add_collaborator',
      description: 'Add a collaborator to a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          username: {
            type: 'string',
            description: 'GitHub username to add',
          },
          permission: {
            type: 'string',
            enum: ['pull', 'push', 'admin'],
            description: 'Permission level (default: push)',
          },
        },
        required: ['owner', 'repo', 'username'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_secrets',
      description: 'List GitHub Actions secrets configured for a repository (names only, not values)',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (user or org)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_variables',
      description: 'List GitHub Actions variables configured for a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (user or org)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_set_secret',
      description: 'Set a GitHub Actions secret for a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (user or org)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          name: {
            type: 'string',
            description: 'Secret name',
          },
          value: {
            type: 'string',
            description: 'Secret value',
          },
        },
        required: ['owner', 'repo', 'name', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_set_variable',
      description: 'Set a GitHub Actions variable for a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner (user or org)',
          },
          repo: {
            type: 'string',
            description: 'Repository name',
          },
          name: {
            type: 'string',
            description: 'Variable name',
          },
          value: {
            type: 'string',
            description: 'Variable value',
          },
        },
        required: ['owner', 'repo', 'name', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_configure_pipeline_secrets',
      description: 'Configure all required secrets and variables for github-auto-team pipelines. REQUIRES HUMAN APPROVAL.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (must have a GitHub repo configured)',
          },
          anthropicApiKey: {
            type: 'string',
            description: 'Anthropic API key for Claude Code',
          },
          claudeWorkflowToken: {
            type: 'string',
            description: 'GitHub PAT with workflow permissions for Claude',
          },
          discordDevWebhookUrl: {
            type: 'string',
            description: 'Discord webhook URL for #dev channel updates',
          },
          discordProductWebhookUrl: {
            type: 'string',
            description: 'Discord webhook URL for #product channel updates',
          },
          openaiApiKey: {
            type: 'string',
            description: 'OpenAI API key for issue relay',
          },
          discordProductChannelId: {
            type: 'string',
            description: 'Discord #product channel ID',
          },
          discordDevChannelId: {
            type: 'string',
            description: 'Discord #dev channel ID',
          },
          discordPrChannelId: {
            type: 'string',
            description: 'Discord #pull-requests channel ID',
          },
          discordTeamLeadUserId: {
            type: 'string',
            description: 'Discord user ID to ping for approvals',
          },
        },
        required: ['projectId', 'anthropicApiKey', 'claudeWorkflowToken'],
      },
    },
  },
];
