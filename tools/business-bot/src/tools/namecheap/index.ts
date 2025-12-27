import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const namecheapTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'namecheap_search_domains',
      description: 'Search for available domain names based on a keyword. Checks common TLDs (.com, .net, .org, .io)',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'The keyword to search for (e.g., "mybusiness")',
          },
          tlds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of TLDs to check (default: com, net, org, io)',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'namecheap_check_domain',
      description: 'Check if a specific domain is available for registration',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The full domain name to check (e.g., "example.com")',
          },
        },
        required: ['domain'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'namecheap_get_pricing',
      description: 'Get pricing information for a domain',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to get pricing for',
          },
        },
        required: ['domain'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'namecheap_list_domains',
      description: 'List all domains owned in the Namecheap account',
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
      name: 'namecheap_get_domain_info',
      description: 'Get detailed information about an owned domain',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to get info for',
          },
        },
        required: ['domain'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'namecheap_register_domain',
      description: 'Register a new domain. REQUIRES HUMAN APPROVAL before execution. This costs real money!',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to register',
          },
          years: {
            type: 'number',
            description: 'Number of years to register (default: 1)',
          },
          projectId: {
            type: 'string',
            description: 'Project ID to associate with this domain',
          },
        },
        required: ['domain', 'projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'namecheap_get_dns',
      description: 'Get DNS records for a domain',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to get DNS records for',
          },
        },
        required: ['domain'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'namecheap_set_dns',
      description: 'Set DNS records for a domain',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to set DNS for',
          },
          records: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                hostName: { type: 'string' },
                type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'] },
                address: { type: 'string' },
                ttl: { type: 'number' },
                mxPref: { type: 'number' },
              },
              required: ['hostName', 'type', 'address', 'ttl'],
            },
            description: 'DNS records to set',
          },
        },
        required: ['domain', 'records'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'namecheap_get_balance',
      description: 'Get the Namecheap account balance',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];
