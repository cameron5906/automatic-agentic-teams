import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const projectTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'project_create',
      description: 'Create a new project to track a business idea',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name',
          },
          description: {
            type: 'string',
            description: 'Brief project description',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_get',
      description: 'Get details about a specific project',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_list',
      description: 'List all projects, optionally filtered by status',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['planning', 'active', 'archived', 'deleted'],
            description: 'Filter by project status',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_add_idea',
      description: 'Add an idea or note to a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          idea: {
            type: 'string',
            description: 'The idea or note to add',
          },
        },
        required: ['projectId', 'idea'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_add_research',
      description: 'Add research findings to a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          research: {
            type: 'string',
            description: 'Research findings to add',
          },
        },
        required: ['projectId', 'research'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_set_business_plan',
      description: 'Set or update the business plan for a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          businessPlan: {
            type: 'string',
            description: 'The full business plan text',
          },
        },
        required: ['projectId', 'businessPlan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_set_status',
      description: 'Update a project status',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          status: {
            type: 'string',
            enum: ['planning', 'active', 'archived', 'deleted'],
            description: 'New status',
          },
        },
        required: ['projectId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_cleanup',
      description: 'Clean up all resources associated with a project. REQUIRES HUMAN APPROVAL for each resource.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID to clean up',
          },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project_status',
      description: 'Get a summary of project health and resource status',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'context_get_overview',
      description: 'Get an overview of all projects, resources, and recent activity to understand the current business landscape. Use this when you need to orient yourself or answer questions about "what projects do we have" or "what are we working on".',
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
      name: 'context_search_history',
      description: 'Search conversation history for past discussions about a topic. Use this to recall previous decisions, discussions, or context about a project or business idea.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or topic to find in past conversations',
          },
          projectId: {
            type: 'string',
            description: 'Optional: limit search to conversations about a specific project',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'context_get_server_info',
      description: 'Get information about the current Discord server and its associated project. Use this to understand the context of where this conversation is happening.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];
