import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const stripeTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'stripe_connect_account',
      description:
        'Connect a Stripe account to a project. Validates the API key and stores it securely for future use. Returns account details if successful.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to associate this Stripe account with',
          },
          secretKey: {
            type: 'string',
            description: 'The Stripe secret API key (starts with sk_live_ or sk_test_)',
          },
          label: {
            type: 'string',
            description: 'Optional friendly name for this Stripe account (e.g., "Main Store", "Subscription Service")',
          },
        },
        required: ['projectId', 'secretKey'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_list_accounts',
      description: 'List all connected Stripe accounts, optionally filtered by project.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional project ID to filter accounts',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_get_balance',
      description: 'Get the current balance for a connected Stripe account.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID (acct_xxx) to query',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_list_customers',
      description: 'List customers in a Stripe account. Supports pagination and email filtering.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID to query',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of customers to return (default: 20, max: 100)',
          },
          email: {
            type: 'string',
            description: 'Filter customers by email address',
          },
          startingAfter: {
            type: 'string',
            description: 'Customer ID to start after (for pagination)',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_get_customer',
      description: 'Get detailed information about a specific customer.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          customerId: {
            type: 'string',
            description: 'The customer ID (cus_xxx)',
          },
        },
        required: ['accountId', 'customerId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_create_customer',
      description: 'Create a new customer in Stripe.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          email: {
            type: 'string',
            description: 'Customer email address',
          },
          name: {
            type: 'string',
            description: 'Customer name',
          },
          phone: {
            type: 'string',
            description: 'Customer phone number',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata key-value pairs',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_update_customer',
      description: 'Update an existing customer in Stripe.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          customerId: {
            type: 'string',
            description: 'The customer ID to update',
          },
          email: {
            type: 'string',
            description: 'New email address',
          },
          name: {
            type: 'string',
            description: 'New name',
          },
          phone: {
            type: 'string',
            description: 'New phone number',
          },
          metadata: {
            type: 'object',
            description: 'Metadata to update',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['accountId', 'customerId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_list_payments',
      description: 'List payment intents (transactions) for a Stripe account.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of payments to return',
          },
          customerId: {
            type: 'string',
            description: 'Filter by customer ID',
          },
          status: {
            type: 'string',
            enum: ['succeeded', 'pending', 'failed'],
            description: 'Filter by payment status',
          },
          startingAfter: {
            type: 'string',
            description: 'Payment ID to start after (for pagination)',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_list_subscriptions',
      description: 'List subscriptions for a Stripe account.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of subscriptions to return',
          },
          customerId: {
            type: 'string',
            description: 'Filter by customer ID',
          },
          status: {
            type: 'string',
            enum: ['active', 'canceled', 'past_due', 'trialing', 'all'],
            description: 'Filter by subscription status',
          },
          startingAfter: {
            type: 'string',
            description: 'Subscription ID to start after (for pagination)',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_list_products',
      description: 'List products and their prices for a Stripe account.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of products to return',
          },
          active: {
            type: 'boolean',
            description: 'Filter by active status',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_create_product',
      description: 'Create a new product in Stripe.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          name: {
            type: 'string',
            description: 'Product name',
          },
          description: {
            type: 'string',
            description: 'Product description',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['accountId', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_create_price',
      description: 'Create a new price for a product.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          productId: {
            type: 'string',
            description: 'The product ID to attach this price to',
          },
          unitAmount: {
            type: 'number',
            description: 'Price amount in dollars (e.g., 9.99)',
          },
          currency: {
            type: 'string',
            description: 'Three-letter currency code (e.g., USD)',
          },
          recurring: {
            type: 'object',
            description: 'For subscription prices, the billing interval',
            properties: {
              interval: {
                type: 'string',
                enum: ['day', 'week', 'month', 'year'],
              },
              intervalCount: {
                type: 'number',
                description: 'Number of intervals between billings (default: 1)',
              },
            },
            required: ['interval'],
          },
        },
        required: ['accountId', 'productId', 'unitAmount', 'currency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_get_revenue',
      description: 'Get revenue statistics for a Stripe account over a time period.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          days: {
            type: 'number',
            description: 'Number of days to look back (default: 30)',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_list_invoices',
      description: 'List invoices for a Stripe account.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of invoices to return',
          },
          customerId: {
            type: 'string',
            description: 'Filter by customer ID',
          },
          status: {
            type: 'string',
            enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
            description: 'Filter by invoice status',
          },
          startingAfter: {
            type: 'string',
            description: 'Invoice ID to start after (for pagination)',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_create_payment_link',
      description: 'Create a payment link that customers can use to pay.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          priceId: {
            type: 'string',
            description: 'The price ID to charge',
          },
          quantity: {
            type: 'number',
            description: 'Quantity of the item (default: 1)',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata for the payment',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['accountId', 'priceId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_list_webhooks',
      description: 'List webhook endpoints configured for a Stripe account.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_create_webhook',
      description:
        'Create a new webhook endpoint. Returns the webhook signing secret which should be stored securely.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          url: {
            type: 'string',
            description: 'The URL that will receive webhook events',
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            description:
              'List of event types to subscribe to (e.g., ["payment_intent.succeeded", "customer.subscription.created"])',
          },
          description: {
            type: 'string',
            description: 'Optional description for the webhook',
          },
        },
        required: ['accountId', 'url', 'events'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_get_integration_keys',
      description:
        'Retrieve integration keys/secrets for a connected Stripe account. Useful for configuring webhooks in other services.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID',
          },
          includeWebhookSecrets: {
            type: 'boolean',
            description: 'Whether to include webhook signing secrets (default: false)',
          },
        },
        required: ['accountId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stripe_disconnect_account',
      description: 'Disconnect a Stripe account from the bot. This removes the stored API key.',
      parameters: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            description: 'The Stripe account ID to disconnect',
          },
          confirm: {
            type: 'boolean',
            description: 'Must be true to confirm disconnection',
          },
        },
        required: ['accountId', 'confirm'],
      },
    },
  },
];
