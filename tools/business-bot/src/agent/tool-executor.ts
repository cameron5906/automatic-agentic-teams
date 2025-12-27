import { LRUCache } from 'lru-cache';
import type { ToolResult, MessageContext, NamecheapDnsRecord } from '../types';
import * as conversationStore from '../context/conversation-store';
import * as projectStore from '../context/project-store';
import { isToolAllowed } from '../state/types';

import * as namecheapDomains from '../tools/namecheap/domains';
import * as namecheapDns from '../tools/namecheap/dns';
import * as githubRepos from '../tools/github/repos';
import * as githubSecrets from '../tools/github/secrets';
import * as discordServers from '../tools/discord/servers';
import * as tavilyResearch from '../tools/tavily/research';
import * as projectLifecycle from '../tools/project/lifecycle';
import * as sqlite from '../context/persistence/sqlite';
import * as stripeService from '../services/stripe';

interface PendingApproval {
  toolName: string;
  args: Record<string, unknown>;
  prompt: string;
  timestamp: number;
}

const APPROVAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const pendingApprovals = new LRUCache<string, PendingApproval>({
  max: 100,
  ttl: APPROVAL_TIMEOUT_MS,
});

export function getPendingApproval(contextKey: string): PendingApproval | undefined {
  const approval = pendingApprovals.get(contextKey);
  if (!approval) return undefined;

  const age = Date.now() - approval.timestamp;
  if (age > APPROVAL_TIMEOUT_MS) {
    pendingApprovals.delete(contextKey);
    return undefined;
  }

  return approval;
}

export function clearPendingApproval(contextKey: string): void {
  pendingApprovals.delete(contextKey);
}

export function setPendingApproval(
  contextKey: string,
  toolName: string,
  args: Record<string, unknown>,
  prompt: string
): void {
  pendingApprovals.set(contextKey, {
    toolName,
    args,
    prompt,
    timestamp: Date.now(),
  });
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: MessageContext
): Promise<ToolResult> {
  const contextKey = conversationStore.getContextKey(context.channelId, context.threadId);
  const currentState = conversationStore.getState(contextKey);

  if (!isToolAllowed(currentState, toolName)) {
    return {
      success: false,
      error: `Tool "${toolName}" is not available in ${currentState} mode. Available tools: see state config.`,
    };
  }

  try {
    switch (toolName) {
      case 'namecheap_search_domains':
        return await namecheapDomains.searchDomains(
          args.keyword as string,
          args.tlds as string[] | undefined
        );

      case 'namecheap_check_domain':
        return await namecheapDomains.checkDomain(args.domain as string);

      case 'namecheap_get_pricing':
        return await namecheapDomains.getDomainPricing(args.domain as string);

      case 'namecheap_list_domains':
        return await namecheapDomains.listDomains();

      case 'namecheap_get_domain_info':
        return await namecheapDomains.getDomainInfo(args.domain as string);

      case 'namecheap_register_domain': {
        const hasApproval = projectStore.hasApproval(args.projectId as string, 'domain');
        const result = await namecheapDomains.registerDomain(
          args.domain as string,
          args.projectId as string,
          (args.years as number) ?? 1,
          hasApproval
        );

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'namecheap_get_balance':
        return await namecheapDomains.getAccountBalance();

      case 'namecheap_get_dns':
        return await namecheapDns.getDnsRecords(args.domain as string);

      case 'namecheap_set_dns':
        return await namecheapDns.setDnsRecords(
          args.domain as string,
          args.records as NamecheapDnsRecord[]
        );

      case 'github_list_repos':
        return await githubRepos.listRepos(args.org as string | undefined);

      case 'github_get_repo':
        return await githubRepos.getRepo(args.owner as string, args.repo as string);

      case 'github_create_repo': {
        const hasApproval = projectStore.hasApproval(args.projectId as string, 'repo');
        const result = await githubRepos.createRepo(
          args.name as string,
          args.projectId as string,
          {
            description: args.description as string | undefined,
            isPrivate: args.isPrivate as boolean | undefined,
          },
          hasApproval
        );

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'github_create_repo_from_template': {
        const hasApproval = projectStore.hasApproval(args.projectId as string, 'repo');
        const result = await githubRepos.createRepoFromTemplate(
          args.name as string,
          args.projectId as string,
          {
            description: args.description as string | undefined,
            isPrivate: args.isPrivate as boolean | undefined,
          },
          hasApproval
        );

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'github_fork_repo': {
        const hasApproval = projectStore.hasApproval(args.projectId as string, 'repo');
        const result = await githubRepos.forkRepo(
          args.owner as string,
          args.repo as string,
          args.projectId as string,
          args.newName as string | undefined,
          hasApproval
        );

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'github_delete_repo': {
        const result = await githubRepos.deleteRepo(
          args.owner as string,
          args.repo as string,
          false
        );

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'github_update_repo':
        return await githubRepos.updateRepo(
          args.owner as string,
          args.repo as string,
          {
            name: args.name as string | undefined,
            description: args.description as string | undefined,
            homepage: args.homepage as string | undefined,
            isPrivate: args.isPrivate as boolean | undefined,
          }
        );

      case 'github_create_file':
        return await githubRepos.createFile(
          args.owner as string,
          args.repo as string,
          args.path as string,
          args.content as string,
          args.message as string,
          args.branch as string | undefined
        );

      case 'github_get_file':
        return await githubRepos.getFile(
          args.owner as string,
          args.repo as string,
          args.path as string,
          args.ref as string | undefined
        );

      case 'github_add_collaborator':
        return await githubRepos.addCollaborator(
          args.owner as string,
          args.repo as string,
          args.username as string,
          args.permission as 'pull' | 'push' | 'admin' | undefined
        );

      case 'github_list_secrets':
        return await githubSecrets.listSecrets(
          args.owner as string,
          args.repo as string
        );

      case 'github_list_variables':
        return await githubSecrets.listVariables(
          args.owner as string,
          args.repo as string
        );

      case 'github_set_secret':
        return await githubSecrets.setSecret(
          args.owner as string,
          args.repo as string,
          args.name as string,
          args.value as string
        );

      case 'github_set_variable':
        return await githubSecrets.setVariable(
          args.owner as string,
          args.repo as string,
          args.name as string,
          args.value as string
        );

      case 'github_configure_pipeline_secrets': {
        const result = await githubSecrets.configurePipelineSecrets(
          args.projectId as string,
          {
            anthropicApiKey: args.anthropicApiKey as string | undefined,
            claudeWorkflowToken: args.claudeWorkflowToken as string | undefined,
            discordDevWebhookUrl: args.discordDevWebhookUrl as string | undefined,
            discordProductWebhookUrl: args.discordProductWebhookUrl as string | undefined,
            openaiApiKey: args.openaiApiKey as string | undefined,
          },
          {
            discordProductChannelId: args.discordProductChannelId as string | undefined,
            discordDevChannelId: args.discordDevChannelId as string | undefined,
            discordPrChannelId: args.discordPrChannelId as string | undefined,
            discordTeamLeadUserId: args.discordTeamLeadUserId as string | undefined,
          },
          false
        );

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'discord_list_servers':
        return await discordServers.listServers();

      case 'discord_get_server':
        return await discordServers.getServer(args.serverId as string);

      case 'discord_create_server': {
        const hasApproval = projectStore.hasApproval(args.projectId as string, 'discord');
        const result = await discordServers.createServer(
          args.name as string,
          args.projectId as string,
          hasApproval
        );

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'discord_setup_channels':
        return await discordServers.setupChannels(args.serverId as string);

      case 'discord_invite_users':
        return await discordServers.inviteUsers(args.serverId as string, {
          userIds: args.userIds as string[] | undefined,
          maxUses: args.maxUses as number | undefined,
          maxAge: args.maxAge as number | undefined,
        });

      case 'discord_delete_server': {
        const result = await discordServers.deleteServer(args.serverId as string, false);

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'discord_create_channel':
        return await discordServers.createChannel(
          args.serverId as string,
          args.name as string,
          {
            type: args.type as 'text' | 'voice' | 'category' | undefined,
            categoryId: args.categoryId as string | undefined,
          }
        );

      case 'discord_create_thread': {
        const channel = context.channel;
        if (channel.isThread()) {
          return {
            success: false,
            error: 'Cannot create a thread inside another thread',
          };
        }
        return await discordServers.createThread(
          channel as import('discord.js').TextChannel,
          args.topic as string,
          args.starterMessage as string | undefined
        );
      }

      case 'tavily_search':
        return await tavilyResearch.search(args.query as string, {
          maxResults: args.maxResults as number | undefined,
          includeDomains: args.includeDomains as string[] | undefined,
          excludeDomains: args.excludeDomains as string[] | undefined,
        });

      case 'tavily_research': {
        const projectId = conversationStore.getProjectId(contextKey);
        return await tavilyResearch.research(
          args.topic as string,
          args.queries as string[],
          {
            maxResultsPerQuery: args.maxResultsPerQuery as number | undefined,
            projectId,
          }
        );
      }

      case 'tavily_market_research': {
        const projectId = conversationStore.getProjectId(contextKey);
        return await tavilyResearch.marketResearch(
          args.businessIdea as string,
          projectId
        );
      }

      case 'tavily_competitor_analysis':
        return await tavilyResearch.competitorAnalysis(args.competitors as string[]);

      case 'tavily_extract':
        return await tavilyResearch.extract(args.urls as string[]);

      case 'tavily_domain_research':
        return await tavilyResearch.domainResearch(args.keyword as string);

      case 'project_create': {
        const result = await projectLifecycle.createProject(
          args.name as string,
          context.authorId,
          args.description as string | undefined,
          context.threadId
        );

        if (result.success && result.data) {
          conversationStore.setProjectId(contextKey, (result.data as { id: string }).id);
        }

        return result;
      }

      case 'project_get':
        return await projectLifecycle.getProject(args.projectId as string);

      case 'project_list':
        return await projectLifecycle.listProjects(
          args.status as 'planning' | 'active' | 'archived' | 'deleted' | undefined
        );

      case 'project_add_idea':
        return await projectLifecycle.addIdea(
          args.projectId as string,
          args.idea as string
        );

      case 'project_add_research':
        return await projectLifecycle.addResearch(
          args.projectId as string,
          args.research as string
        );

      case 'project_set_business_plan':
        return await projectLifecycle.setBusinessPlan(
          args.projectId as string,
          args.businessPlan as string
        );

      case 'project_set_status':
        return await projectLifecycle.setStatus(
          args.projectId as string,
          args.status as 'planning' | 'active' | 'archived' | 'deleted'
        );

      case 'project_status':
        return await projectLifecycle.getProjectStatus(args.projectId as string);

      case 'project_cleanup': {
        const result = await projectLifecycle.cleanupProject(args.projectId as string);

        if (result.requiresApproval) {
          setPendingApproval(contextKey, toolName, args, result.approvalPrompt!);
        }

        return result;
      }

      case 'context_get_overview': {
        const projects = projectStore.listProjects();
        const recentActivity = sqlite.getRecentActivity(10);

        const projectSummaries = projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          description: p.description,
          hasGithub: !!p.resources.github,
          hasDomain: !!p.resources.domain,
          hasDiscord: !!p.resources.discord,
          ideaCount: p.planning.ideas.length,
          hasBusinessPlan: !!p.planning.businessPlan,
        }));

        const activeProjects = projectSummaries.filter((p) => p.status === 'active');
        const planningProjects = projectSummaries.filter((p) => p.status === 'planning');

        return {
          success: true,
          data: {
            totalProjects: projects.length,
            activeProjects: activeProjects.length,
            planningProjects: planningProjects.length,
            projects: projectSummaries,
            recentActivity: recentActivity.map((a) => ({
              contextKey: a.contextKey,
              state: a.state,
              projectId: a.projectId,
              lastActivity: new Date(a.lastActivity).toISOString(),
              messageCount: a.messageCount,
            })),
          },
        };
      }

      case 'context_search_history': {
        const results = sqlite.searchConversationHistory(
          args.query as string,
          args.projectId as string | undefined,
          20
        );

        return {
          success: true,
          data: {
            query: args.query,
            resultCount: results.length,
            results: results.map((r) => ({
              from: r.role === 'user' ? r.authorName ?? 'User' : 'Bot',
              snippet: r.matchedSnippet,
              timestamp: new Date(r.timestamp).toISOString(),
              contextKey: r.contextKey,
            })),
          },
        };
      }

      case 'context_get_server_info': {
        const channel = context.channel;
        const guild = 'guild' in channel ? channel.guild : null;

        if (!guild) {
          return {
            success: false,
            error: 'Not in a server context',
          };
        }

        const project = sqlite.findProjectByServerId(guild.id);
        const ownedThreads = sqlite.getOwnedThreadsByGuild(guild.id);

        return {
          success: true,
          data: {
            server: {
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount,
            },
            associatedProject: project ? {
              id: project.id,
              name: project.name,
              status: project.status,
              description: project.description,
            } : null,
            ownedThreads: ownedThreads.map((t) => ({
              threadId: t.threadId,
              topic: t.topic,
              createdAt: new Date(t.createdAt).toISOString(),
            })),
            currentChannel: {
              id: channel.id,
              name: 'name' in channel ? channel.name : 'DM',
              isThread: channel.isThread(),
            },
          },
        };
      }

      case 'stripe_connect_account': {
        const validation = await stripeService.validateApiKey(args.secretKey as string);

        if (!validation.valid) {
          return {
            success: false,
            error: `Invalid Stripe API key: ${validation.error}`,
          };
        }

        sqlite.saveStripeAccount({
          accountId: validation.accountId!,
          projectId: args.projectId as string,
          secretKey: args.secretKey as string,
          businessName: validation.businessName!,
          label: args.label as string | undefined,
          isLive: validation.isLive,
          connectedAt: Date.now(),
          connectedBy: context.authorId,
          webhookSecrets: {},
        });

        return {
          success: true,
          data: {
            accountId: validation.accountId,
            businessName: validation.businessName,
            isLive: validation.isLive,
            message: `Connected Stripe account: ${validation.businessName} (${validation.isLive ? 'LIVE' : 'TEST'})`,
          },
        };
      }

      case 'stripe_list_accounts': {
        const accounts = sqlite.listStripeAccounts(args.projectId as string | undefined);

        return {
          success: true,
          data: {
            accounts: accounts.map((a) => ({
              accountId: a.accountId,
              businessName: a.businessName,
              label: a.label,
              projectId: a.projectId,
              isLive: a.isLive,
              connectedAt: new Date(a.connectedAt).toISOString(),
            })),
          },
        };
      }

      case 'stripe_get_balance': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found. Connect it first.' };
        }

        const balance = await stripeService.getAccountBalance(account.secretKey);
        return {
          success: true,
          data: {
            accountId: account.accountId,
            businessName: account.businessName,
            ...balance,
          },
        };
      }

      case 'stripe_list_customers': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const result = await stripeService.listCustomers(account.secretKey, {
          limit: args.limit as number | undefined,
          email: args.email as string | undefined,
          startingAfter: args.startingAfter as string | undefined,
        });

        return { success: true, data: result };
      }

      case 'stripe_get_customer': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const customer = await stripeService.getCustomer(
          account.secretKey,
          args.customerId as string
        );

        return { success: true, data: customer };
      }

      case 'stripe_create_customer': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const customer = await stripeService.createCustomer(account.secretKey, {
          email: args.email as string | undefined,
          name: args.name as string | undefined,
          phone: args.phone as string | undefined,
          metadata: args.metadata as Record<string, string> | undefined,
        });

        return {
          success: true,
          data: {
            ...customer,
            message: `Created customer: ${customer.name ?? customer.email ?? customer.id}`,
          },
        };
      }

      case 'stripe_update_customer': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const customer = await stripeService.updateCustomer(
          account.secretKey,
          args.customerId as string,
          {
            email: args.email as string | undefined,
            name: args.name as string | undefined,
            phone: args.phone as string | undefined,
            metadata: args.metadata as Record<string, string> | undefined,
          }
        );

        return { success: true, data: customer };
      }

      case 'stripe_list_payments': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const result = await stripeService.listPayments(account.secretKey, {
          limit: args.limit as number | undefined,
          customerId: args.customerId as string | undefined,
          status: args.status as 'succeeded' | 'pending' | 'failed' | undefined,
          startingAfter: args.startingAfter as string | undefined,
        });

        return { success: true, data: result };
      }

      case 'stripe_list_subscriptions': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const result = await stripeService.listSubscriptions(account.secretKey, {
          limit: args.limit as number | undefined,
          customerId: args.customerId as string | undefined,
          status: args.status as 'active' | 'canceled' | 'past_due' | 'trialing' | 'all' | undefined,
          startingAfter: args.startingAfter as string | undefined,
        });

        return { success: true, data: result };
      }

      case 'stripe_list_products': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const result = await stripeService.listProducts(account.secretKey, {
          limit: args.limit as number | undefined,
          active: args.active as boolean | undefined,
        });

        return { success: true, data: result };
      }

      case 'stripe_create_product': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const product = await stripeService.createProduct(account.secretKey, {
          name: args.name as string,
          description: args.description as string | undefined,
          metadata: args.metadata as Record<string, string> | undefined,
        });

        return {
          success: true,
          data: {
            ...product,
            message: `Created product: ${product.name}`,
          },
        };
      }

      case 'stripe_create_price': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const recurring = args.recurring as { interval: 'day' | 'week' | 'month' | 'year'; intervalCount?: number } | undefined;

        const price = await stripeService.createPrice(account.secretKey, {
          productId: args.productId as string,
          unitAmount: args.unitAmount as number,
          currency: args.currency as string,
          recurring,
        });

        return {
          success: true,
          data: {
            ...price,
            message: `Created price: ${price.unitAmount} ${price.currency}${recurring ? ` per ${recurring.interval}` : ''}`,
          },
        };
      }

      case 'stripe_get_revenue': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const stats = await stripeService.getRevenueStats(account.secretKey, {
          days: args.days as number | undefined,
        });

        return {
          success: true,
          data: {
            businessName: account.businessName,
            ...stats,
          },
        };
      }

      case 'stripe_list_invoices': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const result = await stripeService.listInvoices(account.secretKey, {
          limit: args.limit as number | undefined,
          customerId: args.customerId as string | undefined,
          status: args.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | undefined,
          startingAfter: args.startingAfter as string | undefined,
        });

        return { success: true, data: result };
      }

      case 'stripe_create_payment_link': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const link = await stripeService.createPaymentLink(account.secretKey, {
          priceId: args.priceId as string,
          quantity: args.quantity as number | undefined,
          metadata: args.metadata as Record<string, string> | undefined,
        });

        return {
          success: true,
          data: {
            ...link,
            message: `Created payment link: ${link.url}`,
          },
        };
      }

      case 'stripe_list_webhooks': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const webhooks = await stripeService.getWebhookEndpoints(account.secretKey);

        return { success: true, data: { webhooks } };
      }

      case 'stripe_create_webhook': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const webhook = await stripeService.createWebhookEndpoint(account.secretKey, {
          url: args.url as string,
          events: args.events as string[],
          description: args.description as string | undefined,
        });

        sqlite.updateStripeWebhookSecret(account.accountId, webhook.id, webhook.secret);

        return {
          success: true,
          data: {
            id: webhook.id,
            url: webhook.url,
            secret: webhook.secret,
            message: `Created webhook endpoint. IMPORTANT: Save this signing secret securely: ${webhook.secret}`,
          },
        };
      }

      case 'stripe_get_integration_keys': {
        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const includeWebhookSecrets = args.includeWebhookSecrets as boolean | undefined;

        const keys: Record<string, unknown> = {
          accountId: account.accountId,
          businessName: account.businessName,
          isLive: account.isLive,
          publishableKeyHint: account.isLive
            ? 'Use your pk_live_xxx key from the Stripe Dashboard'
            : 'Use your pk_test_xxx key from the Stripe Dashboard',
        };

        if (includeWebhookSecrets && Object.keys(account.webhookSecrets).length > 0) {
          keys.webhookSecrets = account.webhookSecrets;
        }

        return { success: true, data: keys };
      }

      case 'stripe_disconnect_account': {
        if (args.confirm !== true) {
          return {
            success: false,
            error: 'Must set confirm: true to disconnect account',
          };
        }

        const account = sqlite.getStripeAccount(args.accountId as string);
        if (!account) {
          return { success: false, error: 'Stripe account not found' };
        }

        const deleted = sqlite.deleteStripeAccount(args.accountId as string);

        return {
          success: deleted,
          data: deleted
            ? { message: `Disconnected Stripe account: ${account.businessName}` }
            : undefined,
          error: deleted ? undefined : 'Failed to disconnect account',
        };
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}

export async function executeApprovedTool(
  contextKey: string,
  approval: PendingApproval,
  approvedBy: string
): Promise<ToolResult> {
  clearPendingApproval(contextKey);

  const { toolName, args } = approval;

  if (args.projectId) {
    let resourceType: 'domain' | 'repo' | 'discord' | undefined;

    if (toolName.startsWith('namecheap_register')) {
      resourceType = 'domain';
    } else if (toolName.startsWith('github_create') || toolName.startsWith('github_fork')) {
      resourceType = 'repo';
    } else if (toolName.startsWith('discord_create_server')) {
      resourceType = 'discord';
    }

    if (resourceType) {
      projectStore.setApproval(args.projectId as string, resourceType, true, approvedBy);
    }
  }

  switch (toolName) {
    case 'namecheap_register_domain':
      return await namecheapDomains.registerDomain(
        args.domain as string,
        args.projectId as string,
        (args.years as number) ?? 1,
        true
      );

    case 'github_create_repo':
      return await githubRepos.createRepo(
        args.name as string,
        args.projectId as string,
        {
          description: args.description as string | undefined,
          isPrivate: args.isPrivate as boolean | undefined,
        },
        true
      );

    case 'github_fork_repo':
      return await githubRepos.forkRepo(
        args.owner as string,
        args.repo as string,
        args.projectId as string,
        args.newName as string | undefined,
        true
      );

    case 'github_delete_repo':
      return await githubRepos.deleteRepo(
        args.owner as string,
        args.repo as string,
        true
      );

    case 'discord_create_server':
      return await discordServers.createServer(
        args.name as string,
        args.projectId as string,
        true
      );

    case 'discord_delete_server':
      return await discordServers.deleteServer(args.serverId as string, true);

    case 'github_configure_pipeline_secrets':
      return await githubSecrets.configurePipelineSecrets(
        args.projectId as string,
        {
          anthropicApiKey: args.anthropicApiKey as string | undefined,
          claudeWorkflowToken: args.claudeWorkflowToken as string | undefined,
          discordDevWebhookUrl: args.discordDevWebhookUrl as string | undefined,
          discordProductWebhookUrl: args.discordProductWebhookUrl as string | undefined,
          openaiApiKey: args.openaiApiKey as string | undefined,
        },
        {
          discordProductChannelId: args.discordProductChannelId as string | undefined,
          discordDevChannelId: args.discordDevChannelId as string | undefined,
          discordPrChannelId: args.discordPrChannelId as string | undefined,
          discordTeamLeadUserId: args.discordTeamLeadUserId as string | undefined,
        },
        true
      );

    default:
      return {
        success: false,
        error: `Cannot execute approved tool: ${toolName}`,
      };
  }
}
