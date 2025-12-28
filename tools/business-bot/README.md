# Business Bot

A Discord bot for managing business projects with integrated domain registration, GitHub repository management, Discord server creation, and web research capabilities.

## Features

- **Conversational Interface**: Chat naturally about business ideas and plans
- **State Machine Routing**: GPT-powered intent detection routes conversations to appropriate modes
- **Domain Management**: Search, check availability, and register domains via Namecheap API
- **GitHub Integration**: Create, fork, and manage repositories
- **Discord Server Creation**: Set up Discord servers with standard channel structures
- **Web Research**: Market research, competitor analysis via Tavily API
- **Stripe Integration**: Connect multiple Stripe accounts, manage customers, view revenue, create products
- **Project Lifecycle**: Track projects from idea to active business, including cleanup
- **Human Approval Flow**: All resource creation requires explicit approval
- **Context Awareness**: Remembers past conversations and can search history across projects

## Architecture

```
src/
├── index.ts                    # Discord client, event routing
├── config.ts                   # Environment configuration
├── types.ts                    # TypeScript interfaces
├── state/                      # State machine
│   ├── machine.ts              # State definitions and transitions
│   ├── router.ts               # GPT-based intent routing
│   └── types.ts                # State types
├── agent/                      # GPT agent loop
│   ├── index.ts                # Main conversation loop
│   ├── system-prompt.ts        # Bot persona and rules
│   └── tool-executor.ts        # Tool dispatch
├── context/                    # Persistence
│   ├── conversation-store.ts   # Message history (LRU + SQLite)
│   ├── project-store.ts        # Project state persistence
│   └── persistence/
│       └── sqlite.ts           # SQLite layer
├── tools/                      # Tool definitions
│   ├── index.ts                # Tool registry
│   ├── namecheap/              # Domain management
│   ├── github/                 # Repository management
│   ├── discord/                # Server management
│   ├── tavily/                 # Web research
│   ├── stripe/                 # Payment processing
│   └── project/                # Project lifecycle
└── services/                   # External API clients
    ├── openai.ts               # OpenAI client
    ├── namecheap.ts            # Namecheap API client
    ├── github.ts               # Octokit wrapper
    ├── tavily.ts               # Tavily API client
    └── stripe.ts               # Stripe API client
```

## State Machine

The bot uses a state machine to route conversations:

| State | Description | Available Tools |
|-------|-------------|-----------------|
| `idle` | Waiting for interaction | - |
| `chat` | General conversation | Project listing, context search, Stripe accounts |
| `planning` | Business idea brainstorming | Research, domain search, project management |
| `creating` | Resource creation | All creation tools, Stripe connect (with approval) |
| `managing` | Managing existing projects | Status, DNS, repo updates, Stripe management |
| `researching` | Deep research mode | All Tavily tools |
| `cleanup` | Project teardown | Deletion tools, Stripe disconnect (with approval) |

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o |
| `NAMECHEAP_API_USER` | Namecheap API user |
| `NAMECHEAP_API_KEY` | Namecheap API key |
| `NAMECHEAP_USERNAME` | Namecheap account username |
| `NAMECHEAP_CLIENT_IP` | Whitelisted IP for Namecheap API |
| `GITHUB_TOKEN` | GitHub PAT with repo scope |
| `GITHUB_ORG` | GitHub org/user for new repos |
| `TAVILY_API_KEY` | Tavily API key |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_ADMIN_USER_IDS` | - | Comma-separated admin user IDs |
| `DISCORD_TEAM_USER_IDS` | - | Comma-separated team user IDs |
| `PRODUCT_BOT_CLIENT_ID` | - | Product Bot's client ID for auto-invite links |
| `GITHUB_TEMPLATE_REPO` | `cameron5906/automatic-agentic-teams` | Template repo for new projects (owner/repo format) |
| `NAMECHEAP_SANDBOX` | `false` | Use Namecheap sandbox |
| `BOT_SQLITE_PATH` | `./data/business-bot.sqlite` | SQLite database path |

## Deployment

### Local Development

```bash
cd tools/business-bot
npm install
npm run dev
```

### AWS Deployment

Use the deployment script:

```powershell
# Initial setup (creates all infrastructure)
.\scripts\deploy-business-bot.ps1 -Action setup -Profile myprofile

# Build and push Docker image
.\scripts\deploy-business-bot.ps1 -Action deploy -Profile myprofile

# Start the service
.\scripts\deploy-business-bot.ps1 -Action start -Profile myprofile

# Check status
.\scripts\deploy-business-bot.ps1 -Action status -Profile myprofile

# View logs
.\scripts\deploy-business-bot.ps1 -Action logs -Profile myprofile

# Stop the service
.\scripts\deploy-business-bot.ps1 -Action stop -Profile myprofile

# Tear down all infrastructure
.\scripts\deploy-business-bot.ps1 -Action teardown -Profile myprofile
```

### AWS Secrets Manager

The deploy script creates these secrets in AWS Secrets Manager (prompted during setup):

| Secret Name | Description |
|-------------|-------------|
| `business-bot-discord-token` | Discord bot token |
| `business-bot-openai-key` | OpenAI API key for GPT-4o |
| `business-bot-namecheap-user` | Namecheap API user |
| `business-bot-namecheap-key` | Namecheap API key |
| `business-bot-namecheap-username` | Namecheap account username |
| `business-bot-github-token` | GitHub PAT with repo scope |
| `business-bot-tavily-key` | Tavily API key |

### GitHub Actions

The bot auto-deploys on push to `main` when files in `tools/business-bot/` change.

Required secrets:
- `AWS_ROLE_ARN`: IAM role ARN for OIDC authentication

Required variables:
- `BUSINESS_BOT_ADMIN_USER_IDS`: Admin Discord user IDs
- `BUSINESS_BOT_GITHUB_ORG`: GitHub organization
- `BUSINESS_BOT_NAMECHEAP_CLIENT_IP`: Client IP for Namecheap
- `BUSINESS_BOT_TEAM_USER_IDS`: Team Discord user IDs (optional)
- `BUSINESS_BOT_NAMECHEAP_SANDBOX`: Use sandbox mode (optional, default: false)
- `PRODUCT_BOT_CLIENT_ID`: Product Bot's Discord application client ID (optional)

## Product Bot Integration

When the Business Bot creates a new Discord server for a project, it automatically:

1. **Creates standard channels**: #general, #standup, #product, #dev, #pull-requests
2. **Posts a welcome message** in #general with:
   - Project description and business plan (if available)
   - Introduction to the AI agent team and their roles
   - Channel guide explaining each channel's purpose
   - Getting started instructions
3. **Provides a Product Bot invite link** (if `PRODUCT_BOT_CLIENT_ID` is configured)

The Product Bot handles the day-to-day project management:
- Issue creation from Discord discussions
- PR notifications and approval workflows
- Agent status updates during pipeline runs
- Team coordination and notifications

To enable this integration:
1. Get the Product Bot's Client ID from the Discord Developer Portal
2. Set the `PRODUCT_BOT_CLIENT_ID` environment variable
3. When servers are created, users can click the invite link in the welcome message

## Automatic Repository Configuration

When the Business Bot creates a repository from the template, it automatically scaffolds configuration by:

1. **Discovering** what secrets and variables are configured on the template repository
2. **Copying variables** directly from the template (values are readable)
3. **Identifying secrets** that need user-provided values (secret values cannot be read from GitHub)
4. **Prompting for missing secrets** so the user can provide values

This dynamic approach means the bot always stays in sync with whatever the template has configured, without needing hardcoded lists of secrets/variables.

### Automatic Flow

```
User: Create a repo for my project from the template
Bot: [Creates repo, copies variables, identifies missing secrets]
     Created repo my-org/my-project from template.
     Copied 4 variables from template.
     The following secrets need to be configured: ANTHROPIC_API_KEY, CLAUDE_WORKFLOW_TOKEN, ...

User: Here's my Anthropic key: sk-ant-...
Bot: [Sets the secret]
     Set ANTHROPIC_API_KEY. Still need: CLAUDE_WORKFLOW_TOKEN, ...
```

### Common Secrets (discovered from template)

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Claude API access for agent pipelines |
| `CLAUDE_WORKFLOW_TOKEN` | GitHub PAT with workflow permissions |
| `DISCORD_DEV_WEBHOOK_URL` | Webhook URL for #dev channel updates |
| `DISCORD_PRODUCT_WEBHOOK_URL` | Webhook URL for #product channel updates |
| `OPENAI_API_KEY` | OpenAI API key for issue relay (optional) |
| `DISCORD_E2E_WEBHOOK_URL` | Webhook URL for E2E test result notifications (optional) |

### Common Variables (auto-copied from template)

| Variable | Description |
|----------|-------------|
| `DISCORD_PRODUCT_CHANNEL_ID` | #product channel ID |
| `DISCORD_DEV_CHANNEL_ID` | #dev channel ID |
| `DISCORD_PR_CHANNEL_ID` | #pull-requests channel ID |
| `DISCORD_TEAM_LEAD_USER_ID` | User ID to ping for approvals |
| `APP_PUBLIC_DOMAIN` | Public URL of the deployed app for E2E testing (optional) |

### Manual Configuration

You can also manually scaffold or check template config:

```
@BusinessBot What secrets does the template need?
@BusinessBot Set ANTHROPIC_API_KEY to sk-ant-xxx for my project
```

### Discord Webhooks

To get webhook URLs for your Discord channels:
1. Go to Channel Settings > Integrations > Webhooks
2. Create a webhook for each channel (#dev, #product)
3. Copy the webhook URL and provide it to the bot

### GitHub PAT Permissions

The `CLAUDE_WORKFLOW_TOKEN` needs these scopes:
- `repo` (full repository access)
- `workflow` (update GitHub Actions workflows)

### E2E Testing Configuration

For projects that want automated E2E browser testing after deployments:

1. **Deploy Skyvern infrastructure** (one-time per AWS account):
   ```powershell
   .\scripts\deploy-skyvern.ps1 -Profile "aws-profile" -GithubOrg "your-org"
   ```

2. **Set org-level variables** (shared across all projects):
   - `AWS_REGION`, `SKYVERN_CLUSTER`, `SKYVERN_TASK_DEF`, `SKYVERN_TASK_ROLE_ARN`
   - `SKYVERN_SUBNETS`, `SKYVERN_SECURITY_GROUP`, `SKYVERN_ARTIFACTS_BUCKET`

3. **Per-project configuration** (set by Business Bot):
   - `DISCORD_E2E_WEBHOOK_URL` - Webhook for E2E test notifications
   - `APP_PUBLIC_DOMAIN` - Public URL of the deployed application

See `docs/automation/e2e-testing.md` for full documentation.

## Usage

### Mention the bot

```
@BusinessBot Hey, I have an idea for a new SaaS product
```

### Planning Flow

1. Discuss your business idea
2. Bot creates a project to track it
3. Research market and competitors
4. Check domain availability
5. Refine the business plan over multiple sessions

### Creation Flow

1. When ready, ask to create resources
2. Bot proposes each resource with details
3. Approve each resource creation explicitly
4. Resources are tracked in the project

### Cleanup Flow

1. Ask to clean up a project
2. Bot lists all associated resources
3. Confirm deletion of each resource type
4. Project marked as deleted

## Tool Categories

### Namecheap (Domain)
- `namecheap_search_domains` - Search for available domains
- `namecheap_check_domain` - Check single domain availability
- `namecheap_get_pricing` - Get domain pricing
- `namecheap_list_domains` - List owned domains
- `namecheap_register_domain` - Register domain (approval required)
- `namecheap_get_dns` / `namecheap_set_dns` - DNS management

### GitHub
- `github_list_repos` - List repositories
- `github_create_repo` - Create repository (approval required)
- `github_create_repo_from_template` - Create from template with auto-scaffolding (approval required)
- `github_fork_repo` - Fork repository (approval required)
- `github_delete_repo` - Delete repository (approval required)
- `github_update_repo` - Update repository settings
- `github_create_file` - Create/update files
- `github_list_secrets` - List configured Actions secrets
- `github_list_variables` - List configured Actions variables
- `github_set_secret` - Set an Actions secret
- `github_set_variable` - Set an Actions variable
- `github_configure_pipeline_secrets` - Configure all pipeline secrets/variables (approval required)
- `github_scaffold_repo_config` - Scaffold secrets/variables from template (auto-called on repo creation)
- `github_get_template_config` - View what the template has configured

### Discord
- `discord_create_server` - Create server (approval required)
- `discord_setup_channels` - Set up standard channels
- `discord_invite_users` - Generate invite links
- `discord_delete_server` - Delete server (approval required)

### Tavily (Research)
- `tavily_search` - Web search
- `tavily_research` - Multi-query research
- `tavily_market_research` - Comprehensive market analysis
- `tavily_competitor_analysis` - Competitor deep-dive
- `tavily_extract` - Extract URL content

### Stripe (Payments)
- `stripe_connect_account` - Connect a Stripe account to a project
- `stripe_list_accounts` - List connected Stripe accounts
- `stripe_disconnect_account` - Remove a connected account
- `stripe_get_balance` - Get account balance (available + pending)
- `stripe_list_customers` - List customers with pagination
- `stripe_get_customer` - Get customer details
- `stripe_create_customer` - Create new customer
- `stripe_update_customer` - Update customer info
- `stripe_list_payments` - List payment intents
- `stripe_list_subscriptions` - List subscriptions
- `stripe_list_products` - List products with prices
- `stripe_create_product` - Create new product
- `stripe_create_price` - Create price (one-time or recurring)
- `stripe_get_revenue` - Get revenue stats for time period
- `stripe_list_invoices` - List invoices
- `stripe_create_payment_link` - Create shareable payment link
- `stripe_list_webhooks` - List webhook endpoints
- `stripe_create_webhook` - Create webhook (returns signing secret)
- `stripe_get_integration_keys` - Get keys/secrets for integration

### Context (Memory)
- `context_get_overview` - Get overview of all projects and recent activity
- `context_search_history` - Search past conversations
- `context_get_server_info` - Get current Discord server context and associated project

### Project
- `project_create` - Create project
- `project_get` / `project_list` - View projects
- `project_add_idea` / `project_add_research` - Add planning notes
- `project_set_business_plan` - Set business plan
- `project_cleanup` - Clean up all resources

## Human Approval

The bot requires explicit approval for:
- Domain registration (costs money)
- GitHub repository creation/deletion
- Discord server creation/deletion

Approval flow:
1. Bot proposes action with details
2. User responds with "yes", "approved", "go ahead", etc.
3. Bot executes the action
4. Rejection with "no", "cancel", "stop", etc. cancels the action

## Persistence

- **Conversation history**: SQLite with LRU cache overlay
- **Project state**: SQLite with caching
- **Thread association**: Projects linked to Discord threads
- **Context continuity**: Survives bot restarts

## Discord Bot Setup

1. Create application at https://discord.com/developers/applications
2. Create bot under the application
3. Enable these intents:
   - Message Content Intent
   - Server Members Intent (for invites)
4. Generate invite URL with scopes:
   - `bot`
   - `applications.commands`
5. Bot permissions:
   - Send Messages
   - Read Message History
   - Manage Channels
   - Create Instant Invite
   - Manage Server (for server creation)

## Namecheap Setup

1. Create Namecheap account
2. Enable API access (may require account balance)
3. Whitelist your server IP
4. Use sandbox for testing: `NAMECHEAP_SANDBOX=true`

## Stripe Setup

Stripe accounts are connected at runtime via Discord conversation - no environment variables needed.

### Connecting an Account

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** (starts with `sk_live_` or `sk_test_`)
3. Tell the bot: `@BusinessBot Connect my Stripe account for [project name]`
4. Provide the secret key when prompted
5. The bot validates the key and stores it securely (base64 encoded in SQLite)

### Multi-Account Support

The bot supports connecting multiple Stripe accounts:
- Each account can be associated with a project or used standalone
- Accounts are identified by their Stripe Account ID (`acct_xxx`)
- Both live and test mode accounts are supported
- Label accounts for easy identification (e.g., "Main Store", "Subscriptions")

### Webhook Integration

When you create webhooks through the bot:
1. The signing secret is automatically stored
2. Use `stripe_get_integration_keys` to retrieve secrets later
3. Secrets are stored per-webhook for multiple endpoint support

### Available Operations

- **Read**: Balance, customers, payments, subscriptions, invoices, revenue stats
- **Write**: Create customers, products, prices, payment links, webhooks
- **Manage**: Connect/disconnect accounts, update customer info

## Extending

### Adding New Tools

1. Create tool definition in `src/tools/{category}/index.ts`
2. Implement tool logic in `src/tools/{category}/{name}.ts`
3. Add to tool executor in `src/agent/tool-executor.ts`
4. Add to allowed tools in relevant states (`src/state/types.ts`)

### Adding New States

1. Define state config in `src/state/types.ts`
2. Add transitions in `src/state/machine.ts`
3. Update router intent mapping in `src/state/router.ts`
