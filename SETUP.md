# Setup Guide

This guide walks you through setting up the GitHub Auto Team pipeline from scratch. Whether you're forking this repository as a standalone project or integrating it into an existing codebase, follow these steps to get your AI agent pipeline running.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Claude Max Users (Simplified Setup)](#claude-max-users-simplified-setup)
3. [Quick Start (API Key Setup)](#quick-start-api-key-setup)
4. [GitHub Repository Setup](#github-repository-setup)
5. [Discord Configuration](#discord-configuration)
6. [AWS Setup (Optional - For Discord Bot)](#aws-setup-optional---for-discord-bot)
7. [Integration with Existing Repositories](#integration-with-existing-repositories)
8. [Customizing Agent Definitions](#customizing-agent-definitions)
9. [Troubleshooting](#troubleshooting)
10. [Cost Considerations](#cost-considerations)
11. [Complete Secrets and Variables Reference](#complete-secrets-and-variables-reference)

---

## Prerequisites

Before you begin, ensure you have:

- A GitHub account with admin access to your repository
- **One of the following for Claude access:**
  - An [Anthropic API key](https://console.anthropic.com/) (pay-per-use, recommended for production)
  - A Claude Pro/Max subscription (uses OAuth, see [Claude Max Users](#claude-max-users-simplified-setup))
- A Discord server where you have permission to create webhooks
- (Optional) An AWS account for the always-on Discord bot
- (Optional) An [OpenAI API key](https://platform.openai.com/) for the issue relay feature

---

## Claude Max Users (Simplified Setup)

If you have a **Claude Pro or Max subscription**, you can use OAuth authentication instead of an API key. This approach uses your existing subscription and simplifies initial setup.

### Using `/install-github-app` (Recommended for Max Users)

1. **Open Claude Code** in your terminal
2. **Run the setup command**:
   ```bash
   /install-github-app
   ```
3. **Follow the prompts** - This will:
   - Install the Claude GitHub App on your repository
   - Generate an OAuth token from your subscription
   - Automatically create the `CLAUDE_CODE_OAUTH_TOKEN` secret in your repository

### What Gets Set Up Automatically

| Secret | Description |
|--------|-------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token linked to your Max subscription (replaces `ANTHROPIC_API_KEY`) |

### What You Still Need to Configure Manually

Even with `/install-github-app`, you'll need to add these secrets yourself:

| Secret | Description | How to Get It |
|--------|-------------|---------------|
| `CLAUDE_WORKFLOW_TOKEN` | GitHub PAT with elevated permissions | See [Creating the GitHub Token](#creating-the-github-token) |
| `DISCORD_DEV_WEBHOOK_URL` | Discord webhook for #dev channel | See [Creating Discord Webhooks](#creating-discord-webhooks) |

### Workflow Modification for OAuth

If using OAuth, update your workflow files to use the OAuth token:

```yaml
# Change this:
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

# To this:
claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

### Known Limitations

> **Token Expiration**: OAuth tokens expire after approximately 1 hour. The current `/install-github-app` setup does not include automatic token refresh. For long-running pipelines, you may need to:
>
> 1. Set up manual token refresh using `CLAUDE_REFRESH_TOKEN`
> 2. Or use the traditional `ANTHROPIC_API_KEY` approach instead (see next section)

For production use with this multi-agent pipeline, the **API key approach** (below) is currently more reliable due to the token expiration issue.

### OAuth vs API Key Comparison

| Aspect | OAuth (`CLAUDE_CODE_OAUTH_TOKEN`) | API Key (`ANTHROPIC_API_KEY`) |
|--------|-----------------------------------|-------------------------------|
| **For** | Pro/Max subscribers | All users |
| **Setup** | `/install-github-app` command | Manual from Anthropic Console |
| **Cost** | Uses subscription quota | Pay-per-use API billing |
| **Token Life** | ~1 hour (requires refresh) | Long-lived |
| **Best For** | Quick testing, short workflows | Production pipelines |

---

## Quick Start (API Key Setup)

For the core AI agent pipeline using an Anthropic API key (recommended for production):

### 1. Fork or Copy the Repository

```bash
# Option A: Fork on GitHub, then clone
git clone https://github.com/YOUR_USERNAME/github-auto-team.git

# Option B: Copy workflows into existing repo (see Integration section below)
```

### 2. Create Required Secrets

Go to your repository **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Description | How to Get It |
|--------|-------------|---------------|
| `ANTHROPIC_API_KEY` | Claude API key | [Anthropic Console](https://console.anthropic.com/) → API Keys |
| `CLAUDE_WORKFLOW_TOKEN` | GitHub PAT with elevated permissions | See [Creating the GitHub Token](#creating-the-github-token) |
| `DISCORD_DEV_WEBHOOK_URL` | Discord webhook for #dev channel | See [Creating Discord Webhooks](#creating-discord-webhooks) |

### 3. Create Repository Structure

Ensure these directories and files exist:

```
your-repo/
├── .github/workflows/
│   ├── issue-pipeline.yml
│   └── agent-step.yml
├── tools/
│   └── mcp-discord/
├── working/
│   └── agents/
│       └── definitions/
│           └── (at least one agent .md file)
└── DEVLOG.md (can be empty)
```

### 4. Enable GitHub Actions

Go to **Settings → Actions → General** and ensure:
- Actions permissions: "Allow all actions and reusable workflows"
- Workflow permissions: "Read and write permissions"

### 5. Test the Pipeline

Create a new issue in your repository. The pipeline will trigger automatically.

---

## GitHub Repository Setup

### Creating the GitHub Token

The `CLAUDE_WORKFLOW_TOKEN` requires elevated permissions beyond what `GITHUB_TOKEN` provides.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Configure:
   - **Token name**: `claude-workflow-token` (or similar)
   - **Expiration**: Choose based on your security requirements
   - **Repository access**: Select your target repository
   - **Permissions**:
     - **Contents**: Read and write
     - **Issues**: Read and write
     - **Pull requests**: Read and write
     - **Workflows**: Read and write (required for modifying workflow files)
4. Click **Generate token** and copy immediately
5. Add as repository secret named `CLAUDE_WORKFLOW_TOKEN`

### Repository Settings

#### Actions Permissions

1. Go to **Settings → Actions → General**
2. Under "Actions permissions", select **Allow all actions and reusable workflows**
3. Under "Workflow permissions":
   - Select **Read and write permissions**
   - Check **Allow GitHub Actions to create and approve pull requests**

#### Branch Protection (Recommended)

If using branch protection on `main`:

1. Go to **Settings → Branches → Add rule**
2. For "Require status checks to pass before merging", add any required checks
3. Consider allowing the `github-actions[bot]` to bypass requirements for automated commits

---

## Discord Configuration

### Creating Discord Webhooks

Webhooks allow the pipeline to post updates without a full bot. You'll need webhooks for each channel you want to receive updates.

#### Required: #dev Channel Webhook

1. Open your Discord server
2. Go to **Server Settings → Integrations → Webhooks**
3. Click **New Webhook**
4. Configure:
   - **Name**: `GitHub Agent Updates` (or similar)
   - **Channel**: Select your #dev channel
5. Click **Copy Webhook URL**
6. Add as repository secret `DISCORD_DEV_WEBHOOK_URL`

#### Optional: #product Channel Webhook

For product-related updates (feature requests, user-facing changes):

1. Create another webhook for your #product channel
2. Add as repository secret `DISCORD_PRODUCT_WEBHOOK_URL`

### Optional: Issue Relay Feature

The issue relay uses GPT-4o to post friendly summaries of issue activity to Discord.

**Additional secret required:**

| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o |

Get your key from [OpenAI Platform](https://platform.openai.com/api-keys).

---

## AWS Setup (Optional - For Discord Bot)

Skip this section if you only want the GitHub Actions pipeline. The Discord bot provides an always-on presence for interactive conversations.

### Prerequisites

- AWS CLI installed and configured with a named profile
- Docker installed and running
- PowerShell 5.1+ (Windows) or PowerShell Core (cross-platform)

### Using the Deployment Script

The `scripts/deploy-bot.ps1` script handles all AWS infrastructure automatically.

#### Available Commands

| Command | Description |
|---------|-------------|
| `setup` | Create all AWS infrastructure (ECR, ECS, IAM, Secrets, etc.) |
| `deploy` | Build Docker image and push to ECR |
| `start` | Start the bot service |
| `stop` | Stop the bot service |
| `status` | Check service status and recent events |
| `logs` | Stream CloudWatch logs |
| `teardown` | Delete all infrastructure (destructive!) |

#### Step 1: Initial Setup

Run the setup command to create all AWS resources:

```powershell
.\scripts\deploy-bot.ps1 -Action setup -Profile YOUR_AWS_PROFILE
```

The script will prompt you for:
- Discord bot token
- GitHub PAT (for API access)
- OpenAI API key
- Discord channel IDs (#product, #dev, #pull-requests)
- Team lead user ID (for pings)

> **Finding Discord IDs**: Enable Developer Mode in Discord (**Settings → App Settings → Advanced → Developer Mode**), then right-click channels/users and select **Copy ID**.

#### Step 2: Build and Deploy

Build the Docker image and push to ECR:

```powershell
.\scripts\deploy-bot.ps1 -Action deploy -Profile YOUR_AWS_PROFILE
```

#### Step 3: Start the Bot

Start the ECS service:

```powershell
.\scripts\deploy-bot.ps1 -Action start -Profile YOUR_AWS_PROFILE
```

#### Step 4: Verify

Check that the bot is running:

```powershell
.\scripts\deploy-bot.ps1 -Action status -Profile YOUR_AWS_PROFILE
```

### Managing the Bot

```powershell
# Stop the bot (keeps infrastructure)
.\scripts\deploy-bot.ps1 -Action stop -Profile YOUR_AWS_PROFILE

# View logs
.\scripts\deploy-bot.ps1 -Action logs -Profile YOUR_AWS_PROFILE

# Update after code changes
.\scripts\deploy-bot.ps1 -Action deploy -Profile YOUR_AWS_PROFILE

# Complete teardown (deletes everything)
.\scripts\deploy-bot.ps1 -Action teardown -Profile YOUR_AWS_PROFILE
```

### Script Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-Profile` | (required) | AWS CLI profile name |
| `-Region` | `us-east-1` | AWS region |
| `-ClusterName` | `soyl-cluster` | ECS cluster name |
| `-ServiceName` | `soyl-discord-bot` | ECS service name |
| `-RepoName` | `soyl-discord-bot` | ECR repository name |

Example with custom names:

```powershell
.\scripts\deploy-bot.ps1 -Action setup -Profile myprofile -Region us-west-2 -ClusterName my-cluster
```

### GitHub Actions Auto-Deploy (Optional)

To enable automatic deployments when bot code changes, add this GitHub secret:

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | IAM role ARN for GitHub OIDC (see below) |

The deployment workflow (`.github/workflows/deploy-discord-bot.yml`) will automatically deploy on pushes to `main` that modify `tools/discord-product-bot/`.

#### Setting up GitHub OIDC for AWS

1. Create an IAM Identity Provider for GitHub in AWS Console:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. Create an IAM role with trust policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {
         "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
       },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringLike": {
           "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
         }
       }
     }]
   }
   ```

3. Attach permissions for ECR push and ECS deploy

4. Add the role ARN as `AWS_ROLE_ARN` secret in GitHub

---

## Integration with Existing Repositories

If you have an existing repository and want to add the AI agent pipeline:

### Step 1: Copy Required Files

Copy these directories/files to your repository:

```
.github/workflows/
├── issue-pipeline.yml
├── agent-step.yml
├── issue-discord-relay.yml  (optional)
└── deploy-discord-bot.yml   (optional, for AWS bot)

scripts/
└── deploy-bot.ps1           (optional, for AWS bot)

tools/
├── mcp-discord/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
└── discord-product-bot/     (optional, for AWS bot)

working/
└── agents/
    ├── definitions/
    │   └── *.md              (copy or create your own)
    ├── memory/               (created automatically)
    └── prompts/
        └── orchestrator.md   (optional)
```

### Step 2: Update CLAUDE.md

Add to your existing `CLAUDE.md` (or create one):

```markdown
## AI Agent Pipeline

This repository uses an automated AI agent pipeline. Key locations:

- `working/agents/definitions/` - Agent behavior definitions
- `working/agents/memory/` - Agent persistent memory
- `working/issues/` - Issue context files (auto-generated)
- `DEVLOG.md` - Development session log

For issues processed by the pipeline, agents will:
1. Analyze the issue
2. Plan the approach
3. Implement changes
4. Create a PR
5. Log the session to DEVLOG.md
```

### Step 3: Create DEVLOG.md

Create an empty or minimal `DEVLOG.md` at the repository root:

```markdown
# Development Log

Session summaries from the AI agent pipeline are appended below.

---
```

### Step 4: Customize Agent Definitions

Edit the agent definitions in `working/agents/definitions/` to match your project's:

- Tech stack
- Coding standards
- File structure
- Testing requirements

### Step 5: Configure Secrets

Add all required secrets as described in [Quick Start](#quick-start-api-key-setup).

---

## Customizing Agent Definitions

Each agent has a definition file in `working/agents/definitions/`. These files control agent behavior and are injected into the system prompt.

### Agent Definition Template

```markdown
# Agent Name

## Core Identity

You are the [Role Name] for [Project Name]. Your primary responsibility is...

## Capabilities

- Capability 1
- Capability 2

## Phase-Specific Behavior

### Pre Phase
In the pre phase, you should...

### Main Phase
In the main phase, you should...

### Post Phase
In the post phase, you should...

## Coordination

You work with:
- **Tech Lead**: For architectural guidance
- **Software Engineer**: For implementation details

## Output Format

Always output a JSON summary:
```json
{
  "success": true,
  "summary": "What you did",
  "recommendations": []
}
```

## Anti-Patterns

- Don't do X
- Avoid Y
```

### Available Agents

| Agent | Purpose | When Activated |
|-------|---------|----------------|
| `documentation-sheriff` | Maintain docs, update indexes | Doc-related issues |
| `code-reviewer` | Review PRs, enforce standards | Always (review phase) |
| `infrastructure-engineer` | AWS/CDK changes | Infrastructure issues |
| `product-owner` | Requirements, acceptance criteria | Feature requests |
| `project-manager` | Team coordination, tracking | Multi-agent tasks |
| `security-engineer` | Security review, OWASP | Security-sensitive changes |
| `software-engineer` | Code implementation | Most issues |
| `tech-lead` | Architecture, ADRs | Complex changes |
| `test-engineer` | Test coverage | Code changes |
| `ux-designer` | UI/UX planning | Frontend features |

---

## Troubleshooting

### Pipeline Not Triggering

**Symptoms**: Creating an issue doesn't start the workflow

**Solutions**:
1. Check **Settings → Actions → General** - ensure Actions are enabled
2. Verify the workflow file is on the default branch
3. Check the "Actions" tab for failed runs
4. Ensure the issue event type matches the trigger (`opened`, `labeled`)

### Authentication Errors

**Symptoms**: `403 Forbidden` or `401 Unauthorized` in logs

**Solutions**:
1. Verify `CLAUDE_WORKFLOW_TOKEN` has correct permissions
2. Check token hasn't expired
3. Ensure token has access to the repository
4. Regenerate and update the secret if needed

### Discord Webhook Failures

**Symptoms**: No Discord messages, webhook errors in logs

**Solutions**:
1. Verify webhook URL is correct and complete
2. Check the webhook hasn't been deleted in Discord
3. Ensure the channel still exists
4. Test webhook manually:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"content":"Test message"}' \
     "YOUR_WEBHOOK_URL"
   ```

### Agent Not Finding Files

**Symptoms**: Agent reports "file not found" for expected files

**Solutions**:
1. Ensure agent definition exists in `working/agents/definitions/`
2. Check file permissions
3. Verify the issue context file was created in `working/issues/`
4. Check for filename sanitization issues (special characters)

### AWS Deployment Failures

**Symptoms**: Discord bot deployment fails

**Solutions**:
1. Run `.\scripts\deploy-bot.ps1 -Action status -Profile YOUR_PROFILE` to check service state
2. Run `.\scripts\deploy-bot.ps1 -Action logs -Profile YOUR_PROFILE` to view container logs
3. Verify AWS credentials are valid: `aws sts get-caller-identity --profile YOUR_PROFILE`
4. Check that Docker is running
5. For GitHub Actions deploy: verify OIDC trust relationship and `AWS_ROLE_ARN` secret

### Anthropic API Errors

**Symptoms**: `429 Too Many Requests` or API errors

**Solutions**:
1. Check your Anthropic API usage/limits
2. Verify API key is valid and active
3. Consider adding delays between agent steps
4. Check for rate limiting on complex issues

### OAuth Token Expiration (Max Users)

**Symptoms**: Pipeline fails mid-run with authentication errors after working initially

**Solutions**:
1. OAuth tokens expire after ~1 hour; long pipelines may exceed this
2. **Option A**: Switch to API key authentication for production use
3. **Option B**: Set up token refresh:
   - Find credentials in `~/.claude/.credentials.json`
   - Add `CLAUDE_REFRESH_TOKEN` to your repository secrets
   - Create a GitHub PAT with `write:secrets` permission
   - Add as `SECRETS_ADMIN_PAT` secret for auto-refresh
4. Check [GitHub issue #11016](https://github.com/anthropics/claude-code/issues/11016) for updates

### `/install-github-app` Issues

**Symptoms**: Command fails or generated workflow doesn't work

**Solutions**:
1. Ensure you're logged in: run `/login` first
2. Check the generated workflow includes `github_token: ${{ secrets.GITHUB_TOKEN }}`
3. On Windows, see [GitHub issue #3371](https://github.com/anthropics/claude-code/issues/3371) for known issues
4. Manually add missing parameters to the generated workflow file

---

## Cost Considerations

### API Costs

| Service | Estimated Cost | Notes |
|---------|----------------|-------|
| Anthropic Claude | $0.01 - $0.50 per issue | Depends on agent activations and code complexity |
| OpenAI GPT-4o | $0.001 - $0.01 per issue | Issue relay only, very lightweight |

### AWS Costs (Discord Bot Only)

| Resource | Estimated Cost | Notes |
|----------|----------------|-------|
| ECS Fargate | $5 - $15/month | 1 task with minimal resources |
| ECR | ~$0.10/GB/month | Container images |
| CloudWatch Logs | ~$0.50/GB | Log ingestion and storage |

### GitHub Actions

- **Public repos**: Free
- **Private repos**: Check your plan's included minutes
- Typical run: 2-10 minutes per issue depending on complexity

### Optimization Tips

1. **Minimize agent activations**: Configure orchestrator to be selective
2. **Use caching**: GitHub Actions cache for npm dependencies
3. **Fargate Spot**: Use spot capacity for non-critical bot availability
4. **Right-size tasks**: Start with minimal CPU/memory, scale up if needed

---

## Complete Secrets and Variables Reference

### Required Secrets (Core Pipeline)

| Secret | Used By | Description |
|--------|---------|-------------|
| `ANTHROPIC_API_KEY` | issue-pipeline, agent-step | Claude API key. **Or** use `CLAUDE_CODE_OAUTH_TOKEN` for Max users |
| `CLAUDE_WORKFLOW_TOKEN` | All workflows | GitHub PAT with contents, issues, pull-requests, workflows write access |
| `DISCORD_DEV_WEBHOOK_URL` | agent-step, issue-discord-relay | Discord webhook URL for #dev channel updates |

> **Note for Max Users**: Replace `ANTHROPIC_API_KEY` with `CLAUDE_CODE_OAUTH_TOKEN` (set up via `/install-github-app`)

### Optional Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `DISCORD_PRODUCT_WEBHOOK_URL` | issue-discord-relay | Discord webhook URL for #product channel updates |
| `OPENAI_API_KEY` | issue-discord-relay, discord-product-bot | Required for issue relay and Discord bot intelligence |
| `AWS_ROLE_ARN` | deploy-discord-bot | IAM role ARN for GitHub Actions OIDC |

### Discord Bot Configuration

#### AWS Secrets (via deploy script or Secrets Manager)

The `deploy-bot.ps1` script prompts for these during setup and stores them in AWS Secrets Manager:

| Secret | Description |
|--------|-------------|
| `discord-bot-token` | Discord bot token from Developer Portal |
| `github-token` | GitHub PAT for API access |
| `openai-api-key` | OpenAI API key for GPT-4o |

#### GitHub Variables (Required for Bot)

These **must** be configured as GitHub Variables for the bot to know which channels to use:

| Variable | Description |
|----------|-------------|
| `DISCORD_PRODUCT_CHANNEL_ID` | Your #product channel ID |
| `DISCORD_DEV_CHANNEL_ID` | Your #dev channel ID |
| `DISCORD_PR_CHANNEL_ID` | Your #pull-requests channel ID |
| `DISCORD_TEAM_LEAD_USER_ID` | User ID to ping for approvals |

Go to **Settings → Secrets and variables → Actions → Variables** to add these.

### Finding Discord Channel/User IDs

1. Enable Developer Mode in Discord: **User Settings → App Settings → Advanced → Developer Mode**
2. Right-click any channel or user → **Copy ID**

---

## Next Steps

After completing setup:

1. **Test the pipeline**: Create a test issue and watch the Actions tab
2. **Customize agents**: Modify definitions to match your project's needs
3. **Review DEVLOG.md**: Check session summaries after pipeline runs
4. **Tune the orchestrator**: Adjust which agents activate for different issue types
5. **Set up Discord bot** (optional): Run `.\scripts\deploy-bot.ps1 -Action setup -Profile YOUR_PROFILE`

For more information, see:
- [CLAUDE.md](./CLAUDE.md) - Project-specific instructions
- [ABOUT.md](./ABOUT.md) - Product information and milestones
- [tools/discord-product-bot/README.md](./tools/discord-product-bot/README.md) - Discord bot details
- [tools/mcp-discord/README.md](./tools/mcp-discord/README.md) - MCP server details
