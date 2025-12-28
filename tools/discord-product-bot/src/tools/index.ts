import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const tools: ChatCompletionTool[] = [
  // Agent-scoped tools (read-only)
  {
    type: 'function',
    function: {
      name: 'agent_list',
      description: 'List all available agents in the team. Returns agent names dynamically from the definitions folder.',
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
      name: 'agent_get_status',
      description: 'Get an agent\'s current status including last action, blocking issues, and pending work. Use this to check what an agent is working on.',
      parameters: {
        type: 'object',
        properties: {
          agent_name: {
            type: 'string',
            description: 'Name of the agent (use agent_list to see available agents)',
          },
        },
        required: ['agent_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agent_get_memory',
      description: 'Read an agent\'s full memory file to understand their complete context and history.',
      parameters: {
        type: 'object',
        properties: {
          agent_name: {
            type: 'string',
            description: 'Name of the agent to read memory from',
          },
        },
        required: ['agent_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agent_get_definition',
      description: 'Read an agent\'s system prompt/definition file to understand their role and behavior.',
      parameters: {
        type: 'object',
        properties: {
          agent_name: {
            type: 'string',
            description: 'Name of the agent to read definition from',
          },
        },
        required: ['agent_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agent_nudge',
      description: 'Add a temporary behavioral nudge to an agent\'s system prompt. This commits to the repo. Use for temporary adjustments like "be more thorough on security" or "prioritize performance".',
      parameters: {
        type: 'object',
        properties: {
          agent_name: {
            type: 'string',
            description: 'Name of the agent to nudge',
          },
          nudge: {
            type: 'string',
            description: 'The instruction to add to the agent\'s behavior (e.g., "Pay extra attention to security vulnerabilities in this review")',
          },
          reason: {
            type: 'string',
            description: 'Why this nudge is being applied (used in commit message)',
          },
        },
        required: ['agent_name', 'nudge', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agent_clear_nudge',
      description: 'Remove the current nudge from an agent\'s definition, returning them to default behavior.',
      parameters: {
        type: 'object',
        properties: {
          agent_name: {
            type: 'string',
            description: 'Name of the agent to clear nudge from',
          },
        },
        required: ['agent_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'team_get_status',
      description: 'Get the overall team status including active milestone, completed work, and open questions from TEAM.md.',
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
      name: 'team_get_active_milestone',
      description: 'Get just the current active milestone the team is working on.',
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
      name: 'team_get_composition',
      description: 'Get the full team composition with all agents, their definition paths, and memory paths.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  // Documentation tools
  {
    type: 'function',
    function: {
      name: 'docs_list_adrs',
      description: 'List all Architecture Decision Records (ADRs) in docs/adr/.',
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
      name: 'docs_list_research',
      description: 'List all research documents in docs/research/.',
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
      name: 'docs_list_issue_contexts',
      description: 'List all issue context files in working/issues/.',
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
      name: 'docs_get_adr',
      description: 'Read a specific ADR by name or partial match.',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'ADR identifier (e.g., "authentication", "2024-01-15-auth")',
          },
        },
        required: ['identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs_get_research',
      description: 'Read a specific research document by name or partial match.',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Research doc identifier (e.g., "caching", "performance")',
          },
        },
        required: ['identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs_get_issue_context',
      description: 'Read the context file for a specific GitHub issue.',
      parameters: {
        type: 'object',
        properties: {
          issue_number: {
            type: 'number',
            description: 'The GitHub issue number',
          },
        },
        required: ['issue_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs_search',
      description: 'Search across documentation for a term.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          doc_type: {
            type: 'string',
            enum: ['adr', 'research', 'issue-context'],
            description: 'Optional: filter by document type',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs_get_index',
      description: 'Get a summary of all documentation: counts and paths for ADRs, research, and issue contexts.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  // Repo-scoped tools
  {
    type: 'function',
    function: {
      name: 'repo_search_code',
      description: 'Search for code patterns in the repository using GitHub code search. Returns file paths and text matches.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "InterviewService", "handleMessage")',
          },
          file_extension: {
            type: 'string',
            description: 'Optional file extension filter (e.g., "ts", "cs", "tsx")',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_read_file',
      description: 'Read the contents of a file from the repository. Use this after searching to see full file contents.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file relative to repo root (e.g., "backend/src/Services/InterviewService.cs")',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_list_files',
      description: 'List files in a directory. Use to explore the repository structure.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to repo root (e.g., "backend/src/Services")',
          },
          pattern: {
            type: 'string',
            description: 'Optional glob pattern to filter files (e.g., "*.ts", "*.cs")',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_get_issue',
      description: 'Get details of a specific GitHub issue including title, body, state, and labels.',
      parameters: {
        type: 'object',
        properties: {
          issue_number: {
            type: 'number',
            description: 'The issue number',
          },
        },
        required: ['issue_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_list_issues',
      description: 'List GitHub issues with optional filters. Use to see what work items exist.',
      parameters: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Filter by issue state (default: open)',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by labels (e.g., ["bug", "enhancement"])',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of issues to return (default: 10)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_create_issue',
      description: 'Create a new GitHub issue. Only use this for: feature requests, bug reports, review requests, or build/test issues. When images were attached to the Discord message, embed them in the body using markdown: ![description](url)',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Issue title - be concise and descriptive',
          },
          body: {
            type: 'string',
            description: 'Issue body with details. Include context from the Discord conversation.',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels to apply. Valid: "bug", "enhancement", "question", "documentation", "review"',
          },
          fast_track: {
            type: 'boolean',
            description: 'Set true only if the user explicitly requested skipping the thread/consent flow.',
          },
        },
        required: ['title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_get_pr',
      description: 'Get details of a specific pull request including title, body, state, and author.',
      parameters: {
        type: 'object',
        properties: {
          pr_number: {
            type: 'number',
            description: 'The pull request number',
          },
        },
        required: ['pr_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_list_prs',
      description: 'List pull requests with optional state filter.',
      parameters: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description: 'Filter by PR state (default: open)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of PRs to return (default: 10)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_get_workflow_runs',
      description: 'Get recent GitHub Actions workflow runs. Use to check CI/CD status.',
      parameters: {
        type: 'object',
        properties: {
          workflow_name: {
            type: 'string',
            description: 'Filter by workflow name or file (e.g., "deploy", "ci.yml")',
          },
          status: {
            type: 'string',
            enum: ['completed', 'in_progress', 'queued'],
            description: 'Filter by run status',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of runs to return (default: 10)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_get_deployment_status',
      description: 'Get the latest deployment status for an environment.',
      parameters: {
        type: 'object',
        properties: {
          environment: {
            type: 'string',
            description: 'Environment name (e.g., "dev", "staging", "prod"). Defaults to "dev".',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'repo_commit_attachment',
      description: 'Commit a file attachment (image, screenshot, etc.) to the repository for permanent storage. Use this when creating issues with screenshots - Discord CDN URLs expire, but committed files are permanent. Returns a permanent URL to use in issue bodies.',
      parameters: {
        type: 'object',
        properties: {
          attachment_url: {
            type: 'string',
            description: 'The Discord attachment URL to download and commit',
          },
          target_path: {
            type: 'string',
            description: 'Path in the repo to store the file (e.g., "docs/assets/issues/screenshot-2024-01-15.png")',
          },
          commit_message: {
            type: 'string',
            description: 'Commit message describing the file (e.g., "Add screenshot for issue: login button not working")',
          },
        },
        required: ['attachment_url', 'target_path', 'commit_message'],
      },
    },
  },

  // Discord-scoped tools
  {
    type: 'function',
    function: {
      name: 'discord_reply',
      description: 'Reply directly to the message. Use this for your main response.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The message content to send. Supports Discord markdown.',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_react',
      description: 'Add a reaction emoji to the message. Use for quick acknowledgments.',
      parameters: {
        type: 'object',
        properties: {
          emoji: {
            type: 'string',
            description: 'The emoji to react with (e.g., "👍", "✅", "🔍")',
          },
        },
        required: ['emoji'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_create_thread',
      description: 'Create a thread from the message for extended discussions.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Thread name (max 100 characters)',
          },
          initial_message: {
            type: 'string',
            description: 'Optional first message to post in the thread',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discord_reply_thread',
      description: 'Reply in an existing thread.',
      parameters: {
        type: 'object',
        properties: {
          thread_id: {
            type: 'string',
            description: 'The thread ID to reply in',
          },
          content: {
            type: 'string',
            description: 'The message content to send',
          },
        },
        required: ['thread_id', 'content'],
      },
    },
  },

  // Ticket flow tools
  {
    type: 'function',
    function: {
      name: 'ticket_start_flow',
      description: 'Start a new ticket creation flow. Classifies the request and creates a draft. Must be in a thread.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The initial request content to classify and start the flow',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_draft',
      description: 'Update a field in the draft, refresh the draft embed, and reply to the draft message. This is the ONLY tool to use when updating draft fields - it handles everything automatically.',
      parameters: {
        type: 'object',
        properties: {
          field_name: {
            type: 'string',
            description: 'The field name to update (e.g., "problem", "reproductionSteps", "severity")',
          },
          value: {
            type: 'string',
            description: 'The value for the field. For list fields, separate items with newlines.',
          },
          reply_message: {
            type: 'string',
            description: 'Brief message to reply with (e.g., "✅ Updated severity to P0. Ready to file!")',
          },
        },
        required: ['field_name', 'value', 'reply_message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ticket_get_draft',
      description: 'Get the current draft status including which fields are filled and which are missing.',
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
      name: 'ticket_get_draft_message',
      description: 'Get the formatted draft message content to post/update in Discord.',
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
      name: 'ticket_preview',
      description: 'Get a preview of the final issue body before filing.',
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
      name: 'ticket_file_issue',
      description: 'File the current draft as a GitHub issue. The draft must be complete (all required fields filled).',
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
      name: 'ticket_cancel',
      description: 'Cancel the current draft and discard it.',
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
      name: 'ticket_decompose_epic',
      description: 'For epic drafts only: decompose the epic into child issues. Shows a preview of the breakdown.',
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
      name: 'ticket_file_epic_with_children',
      description: 'File an epic and all its child issues. Must call ticket_decompose_epic first.',
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
      name: 'ticket_list_types',
      description: 'List all available issue types with their required fields.',
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
      name: 'ticket_get_field_info',
      description: 'Get detailed information about a specific field for an issue type.',
      parameters: {
        type: 'object',
        properties: {
          issue_type: {
            type: 'string',
            description: 'The issue type (e.g., "feature", "bug", "task")',
          },
          field_name: {
            type: 'string',
            description: 'The field name to get info about',
          },
        },
        required: ['issue_type', 'field_name'],
      },
    },
  },
];

export const toolNames = tools.map((t) => t.function.name);
