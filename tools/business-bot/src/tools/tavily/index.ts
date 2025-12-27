import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const tavilyTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'tavily_search',
      description: 'Perform a web search using Tavily API',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results (default: 10)',
          },
          includeDomains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only include results from these domains',
          },
          excludeDomains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exclude results from these domains',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tavily_research',
      description: 'Conduct deep research on a topic using multiple queries',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The main topic to research',
          },
          queries: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of specific search queries to run',
          },
          maxResultsPerQuery: {
            type: 'number',
            description: 'Max results per query (default: 5)',
          },
        },
        required: ['topic', 'queries'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tavily_market_research',
      description: 'Conduct comprehensive market research for a business idea',
      parameters: {
        type: 'object',
        properties: {
          businessIdea: {
            type: 'string',
            description: 'The business idea to research',
          },
        },
        required: ['businessIdea'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tavily_competitor_analysis',
      description: 'Analyze specific competitors',
      parameters: {
        type: 'object',
        properties: {
          competitors: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of competitor names to analyze',
          },
        },
        required: ['competitors'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tavily_extract',
      description: 'Extract content from specific URLs',
      parameters: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URLs to extract content from',
          },
        },
        required: ['urls'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tavily_domain_research',
      description: 'Research brandability and SEO value of a potential domain/keyword',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'The keyword/domain name to research',
          },
        },
        required: ['keyword'],
      },
    },
  },
];
