import type { BotState } from '../types';

export interface StateConfig {
  name: BotState;
  description: string;
  allowedTools: string[];
  systemPromptAddition: string;
  exitConditions: string[];
}

export interface StateTransitionResult {
  newState: BotState;
  reason: string;
  confidence: number;
}

export const STATE_CONFIGS: Record<BotState, StateConfig> = {
  idle: {
    name: 'idle',
    description: 'Waiting for user interaction',
    allowedTools: [],
    systemPromptAddition: '',
    exitConditions: ['Any user message'],
  },

  chat: {
    name: 'chat',
    description: 'General conversation and casual discussion',
    allowedTools: [
      'project_list',
      'project_get',
      'context_get_overview',
      'context_search_history',
      'context_get_server_info',
      'stripe_list_accounts',
    ],
    systemPromptAddition: `
You are in casual chat mode. Have a friendly conversation with the user.
If they start discussing business ideas, transition to planning mode.
If they want to check on projects, help them with that.
Keep the conversation natural and engaging.`,
    exitConditions: [
      'User starts discussing business ideas → planning',
      'User asks to create resources → creating',
      'User asks about project status → managing',
    ],
  },

  planning: {
    name: 'planning',
    description: 'Brainstorming and planning business ideas',
    allowedTools: [
      'project_create',
      'project_get',
      'project_list',
      'project_add_idea',
      'project_add_research',
      'project_set_business_plan',
      'tavily_search',
      'tavily_research',
      'tavily_market_research',
      'namecheap_search_domains',
      'namecheap_get_pricing',
      'github_list_repos',
    ],
    systemPromptAddition: `
You are in business planning mode. This is a collaborative exploration phase.

**Your Role Here:**
- Be genuinely curious about the idea - ask thoughtful questions
- Share your own opinions and suggestions ("I think...", "What if we...")
- Push back respectfully if something seems off
- Take your time - good planning prevents problems later

**Pacing:**
1. Start by understanding the vision - ask 1-2 clarifying questions
2. Create a project to track the discussion
3. Research together - check domain availability, market size
4. Help build up a business plan incrementally
5. Only move to creation when there's a solid plan

**Don't Rush:**
- It's fine if this takes multiple conversations
- Focus on one topic at a time
- Let the user drive the pace
- Ask "What do you think?" and wait for their response

When a project thread is created, link all planning to that project.`,
    exitConditions: [
      'User is ready to create resources → creating',
      'User wants to do deep research → researching',
      'User changes topic → chat',
    ],
  },

  creating: {
    name: 'creating',
    description: 'Creating project resources (domains, repos, Discord, Stripe)',
    allowedTools: [
      'project_get',
      'project_list',
      'namecheap_search_domains',
      'namecheap_get_pricing',
      'namecheap_register_domain',
      'namecheap_list_domains',
      'namecheap_set_dns',
      'github_create_repo',
      'github_create_repo_from_template',
      'github_fork_repo',
      'github_list_repos',
      'github_get_repo',
      'github_create_file',
      'github_scaffold_repo_config',
      'github_get_template_config',
      'github_set_secret',
      'github_set_variable',
      'discord_create_server',
      'discord_setup_channels',
      'discord_create_webhook',
      'discord_get_channel_ids',
      'discord_invite_users',
      'project_set_domain',
      'project_set_github',
      'project_set_discord',
      'project_set_status',
      'stripe_connect_account',
      'stripe_list_accounts',
      'stripe_create_product',
      'stripe_create_price',
      'stripe_create_webhook',
    ],
    systemPromptAddition: `
You are in resource creation mode. Help create the infrastructure for the project.

IMPORTANT: Always get explicit human approval before:
- Registering a domain (costs money!)
- Creating a new Discord server
- Forking/creating repositories

**Recommended Creation Order:**
1. **Domain** (optional) - Register if user wants one
2. **Discord Server** - Create server, setup channels with webhooks
3. **GitHub Repository** - Create from template, auto-configure with Discord webhooks

**Discord Setup Flow:**
When setting up Discord:
1. Create the server with discord_create_server
2. Run discord_setup_channels - this automatically creates channels AND webhooks
3. The webhooks are stored in the project and can be used for GitHub configuration

**GitHub Configuration Flow:**
After creating the repo from template:
1. Use github_scaffold_repo_config to auto-configure secrets/variables
2. The Discord webhook URLs from the project are automatically available
3. Ask user for any missing secrets (ANTHROPIC_API_KEY, CLAUDE_WORKFLOW_TOKEN, etc.)

Flow for each resource:
1. Propose the action with details (cost, name, etc.)
2. Wait for explicit approval ("yes", "go ahead", "approved")
3. Execute the action
4. Update the project with the new resource

Track all created resources in the project so they can be cleaned up later.`,
    exitConditions: [
      'All resources created → managing',
      'User cancels → planning',
      'User changes topic → chat',
    ],
  },

  managing: {
    name: 'managing',
    description: 'Managing existing projects and their resources',
    allowedTools: [
      'project_get',
      'project_list',
      'project_status',
      'namecheap_list_domains',
      'namecheap_get_domain_info',
      'namecheap_get_dns',
      'namecheap_set_dns',
      'github_list_repos',
      'github_get_repo',
      'github_update_repo',
      'github_create_file',
      'discord_list_servers',
      'stripe_list_accounts',
      'stripe_get_balance',
      'stripe_list_customers',
      'stripe_get_customer',
      'stripe_create_customer',
      'stripe_update_customer',
      'stripe_list_payments',
      'stripe_list_subscriptions',
      'stripe_list_products',
      'stripe_get_revenue',
      'stripe_list_invoices',
      'stripe_create_payment_link',
      'stripe_list_webhooks',
      'stripe_get_integration_keys',
      'context_get_overview',
      'context_search_history',
      'context_get_server_info',
    ],
    systemPromptAddition: `
You are in project management mode. Help the user manage their existing projects.
- Check project status and health
- Update DNS records or repository settings
- Monitor domain expiration
- Help with any maintenance tasks

If the user wants to clean up a project, transition to cleanup mode.`,
    exitConditions: [
      'User wants to clean up → cleanup',
      'User has new ideas → planning',
      'User changes topic → chat',
    ],
  },

  researching: {
    name: 'researching',
    description: 'Deep research mode for market analysis',
    allowedTools: [
      'tavily_search',
      'tavily_research',
      'tavily_market_research',
      'tavily_competitor_analysis',
      'tavily_extract',
      'project_add_research',
      'project_get',
    ],
    systemPromptAddition: `
You are in deep research mode. Conduct thorough research for the user.
- Use multiple search queries to gather comprehensive information
- Analyze competitors and market trends
- Extract relevant content from key websites
- Summarize findings and add them to the project

Take your time to do thorough research. Quality over speed.`,
    exitConditions: [
      'Research complete → planning',
      'User wants to proceed → creating',
      'User changes topic → chat',
    ],
  },

  cleanup: {
    name: 'cleanup',
    description: 'Cleaning up and deleting project resources',
    allowedTools: [
      'project_get',
      'project_list',
      'project_cleanup',
      'project_set_status',
      'namecheap_list_domains',
      'github_list_repos',
      'github_delete_repo',
      'discord_delete_server',
      'discord_list_servers',
      'stripe_list_accounts',
      'stripe_disconnect_account',
    ],
    systemPromptAddition: `
You are in cleanup mode. Help the user safely clean up project resources.

CRITICAL: Always get explicit approval before deleting anything!

Cleanup process:
1. List all resources associated with the project
2. Explain what will be deleted and any costs/implications
3. Get explicit confirmation for EACH resource type
4. Delete resources one by one, confirming success
5. Mark the project as deleted

Be very careful - deleted resources cannot be recovered!

Note: Domains can be transferred or let expire, but typically can't be refunded.`,
    exitConditions: [
      'Cleanup complete → chat',
      'User cancels → managing',
    ],
  },
};

export function getStateConfig(state: BotState): StateConfig {
  return STATE_CONFIGS[state];
}

export function isToolAllowed(state: BotState, toolName: string): boolean {
  const config = getStateConfig(state);
  return config.allowedTools.length === 0 || config.allowedTools.includes(toolName);
}
