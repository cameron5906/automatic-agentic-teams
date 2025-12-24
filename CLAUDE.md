# GitHub Auto Team

Automated software development pipeline using Claude Code GitHub Actions with multi-agent orchestration.

## Project Overview

This system processes GitHub issues through a staged pipeline where specialized AI agents collaborate to implement features, fix bugs, and maintain code quality. An orchestrator analyzes each issue and delegates to appropriate agents based on the work required.

## Directory Structure

```
github-auto-team/
├── .github/workflows/
│   ├── issue-pipeline.yml      # Main 9-stage pipeline workflow
│   ├── debt-pipeline.yml       # Daily tech debt curation (7 PM UTC)
│   ├── agent-step.yml          # Reusable agent execution workflow
│   ├── deploy-discord-bot.yml  # Discord bot Fargate deployment
│   ├── issue-discord-relay.yml # Relays issue updates to Discord via GPT-4o
│   └── ci-tools.yml            # CI for tools (build, test, Docker)
├── tools/
│   ├── discord-product-bot/    # Always-on Discord bot (Fargate)
│   └── mcp-discord/            # MCP server for agent Discord updates
├── docs/
│   ├── README.md               # Documentation index
│   ├── adr/
│   │   └── README.md           # ADR index with template
│   └── research/
│       └── README.md           # Research docs index with template
├── working/
│   ├── issues/                 # Issue context files ({number} {title}.md)
│   └── agents/
│       ├── SHARED.md           # Shared team context (tech debt, bugs, improvements across issues)
│       ├── definitions/        # Agent behavior definitions (loaded into SYSTEM PROMPT)
│       │   ├── code-reviewer.md
│       │   ├── documentation-sheriff.md
│       │   ├── infrastructure-engineer.md
│       │   ├── product-owner.md
│       │   ├── project-manager.md
│       │   ├── security-engineer.md
│       │   ├── software-engineer.md
│       │   ├── tech-lead.md
│       │   ├── test-engineer.md
│       │   └── ux-designer.md
│       ├── memory/             # Agent persistent memory
│       │   └── {agent-name}/MEMORY.md
│       └── prompts/
│           └── orchestrator.md # Orchestrator system prompt
├── ABOUT.md                    # Product info, milestones, business requirements
├── DEVLOG.md                   # Session log (grep for "## Session" for recent context)
└── README.md                   # Project documentation
```

## Pipelines

### Issue Pipeline (`issue-pipeline.yml`)

Triggered by new issues or the `work-on-this` label. Processes issues through 9 stages:

1. **Orchestrate**: Analyze issue, determine which agents to activate
2. **Pre-Work**: Documentation Sheriff captures current state
3. **Planning**: Tech Lead, Product Owner, UX Designer, Security Engineer plan approach
4. **Development**: Software Engineer implements, Infrastructure Engineer handles AWS/CDK
5. **Post-Work**: Test Engineer verifies tests, Security Engineer reviews, Documentation Sheriff updates docs
6. **Project Management**: Project Manager updates TEAM.md
7. **Create PR**: Create pull request with changes
8. **Code Review**: Code Reviewer validates and approves/rejects
9. **Wrap-Up**: Append session summary to DEVLOG.md

### Debt Pipeline (`debt-pipeline.yml`)

Runs daily at 7 PM UTC (also supports manual trigger). Processes technical debt from `working/agents/SHARED.md`:

1. **Curate**: Debt Curator reviews SHARED.md, validates items still relevant, selects up to 2 priority items
2. **Create Issues**: Selected items become GitHub issues with appropriate labels
3. **Summary**: Posts completion update to Discord

The Debt Pipeline does NOT make code changes directly—it only creates issues that can then be processed by the Issue Pipeline.

## Agent Team

### Issue Pipeline Agents

| Agent | Phase | Primary Responsibility |
|-------|-------|------------------------|
| Documentation Sheriff | PRE, POST | Documentation integrity, index updates |
| Code Reviewer | REVIEW | PR validation, quality gate |
| Infrastructure Engineer | PRE, MAIN, POST | AWS/CDK infrastructure |
| Product Owner | PLANNING | Feature alignment, acceptance criteria |
| Project Manager | PROJECT-MGMT | TEAM.md, milestones, tribal knowledge |
| Security Engineer | PRE, POST | Security requirements, OWASP review |
| Software Engineer | DEVELOPMENT | Code implementation, git commits |
| Tech Lead | PLANNING | Architecture, ADRs, engineer guidance |
| Test Engineer | POST-DEV | Test coverage verification |
| UX Designer | PLANNING | User flows, accessibility, components |

### Debt Pipeline Agents

| Agent | Stage | Primary Responsibility |
|-------|-------|------------------------|
| Debt Curator | CURATE | Reviews SHARED.md, validates items, selects priorities for issue creation |

## Key Files

### DEVLOG.md
Large development log. **DO NOT read entirely.** Use:
```bash
grep -A 20 "## Session" DEVLOG.md | tail -40
```

### ABOUT.md
Product information, business requirements, milestones. Read fully when planning features.

### Issue Context Files
Located at `working/issues/{number} {title}.md`. Created per-issue for cross-agent communication. Contains orchestrator analysis, agent contributions, and validation results.

### ADRs
Architecture Decision Records in `docs/adr/`. Filename format: `YYYY-MM-DD-short-description.md`. Always check existing ADRs before making architectural decisions.

### SHARED.md
Located at `working/agents/SHARED.md`. Shared team context for tracking tech debt, bugs, and improvements discovered across all issues. Agents contribute side findings here during issue processing. The Debt Curator reviews this file daily and converts priority items into GitHub issues.

Sections:
- **Technical Debt**: Code needing refactoring, design pattern violations
- **Non-Critical Bugs**: Bugs that don't block current work
- **Security Concerns**: Potential vulnerabilities, hardening opportunities
- **Infrastructure Improvements**: Performance, scaling, monitoring
- **UX Patterns to Standardize**: Inconsistencies, accessibility gaps
- **Archive**: Resolved items (auto-pruned after 30 days)

Entry format: `- [ ] {description} - Found in #{issue}, {agent}, YYYY-MM-DD`

## Secrets Required

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Claude API access |
| `CLAUDE_WORKFLOW_TOKEN` | GitHub PAT with workflow file edit permissions |
| `DISCORD_DEV_WEBHOOK_URL` | Discord webhook for agent dev updates |
| `DISCORD_PRODUCT_WEBHOOK_URL` | Discord webhook for product channel updates |
| `AWS_ROLE_ARN` | IAM role ARN for GitHub Actions OIDC (bot deployment) |
| `DISCORD_BOT_TOKEN` | Discord bot token (bot deployment) |
| `OPENAI_API_KEY` | OpenAI API key (bot deployment, issue relay) |

## Variables (Required for Bot)

| Variable | Description |
|----------|-------------|
| `DISCORD_PRODUCT_CHANNEL_ID` | #product channel ID |
| `DISCORD_DEV_CHANNEL_ID` | #dev channel ID |
| `DISCORD_PR_CHANNEL_ID` | #pull-requests channel ID |
| `DISCORD_TEAM_LEAD_USER_ID` | User ID to ping for approvals |

## Variables (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region for bot deployment |
| `ECR_REPOSITORY` | `soyl-discord-bot` | ECR repository name |
| `ECS_CLUSTER` | `soyl-cluster` | ECS cluster name |
| `ECS_SERVICE` | `soyl-discord-bot` | ECS service name |

## Tools

### Discord Product Bot (`tools/discord-product-bot/`)
Always-on Discord bot deployed to AWS Fargate. Monitors product and dev channels for user interactions.
- Auto-deploys on push to `main` when `tools/discord-product-bot/**` changes
- See `tools/discord-product-bot/README.md` for deployment setup

### MCP Discord (`tools/mcp-discord/`)
MCP server that gives agents the ability to post updates to Discord during pipeline execution.
- Built and loaded automatically in `agent-step.yml`
- Agents use `discord_post_dev_update` tool for status updates
- Categories: `tech_debt`, `progress`, `delay`, `thinking`
- See `tools/mcp-discord/README.md` for details

### Issue Discord Relay (`.github/workflows/issue-discord-relay.yml`)
Monitors issue and comment events, uses GPT-4o to generate friendly #dev channel updates.
- Triggers on `issues` (opened, edited) and `issue_comment` (created, edited) events
- Filters for github-actions[bot] or Claude-related content
- GPT-4o generates casual team updates with issue title as h2 header
- Detects meaningful changes on edits, skips trivial updates

## Documentation Search Strategy

For planning agents, use grep-first approach:
```bash
# Search before reading full files
grep -r "term" docs/adr/
grep -r "## Decision" docs/adr/

# Check indexes first
# Read docs/adr/README.md, docs/research/README.md

# Fall back to thorough review if grep doesn't find what you need
```

## Git Conventions

- Conventional commits: `feat(scope): description`
- Reference issues: `Refs: #123`
- Atomic commits: one logical change per commit
- Never leave uncommitted changes at step end

## Resource Naming (CDK/AWS)

```typescript
`soyl-${environment}-${identifier}`
// Example: soyl-dev-ecs
```

## Agent Definition Pattern

Each agent definition in `working/agents/definitions/` follows ReAct pattern:
- Core Identity (persona)
- Phase-Specific Behavior (reasoning process + actions)
- Coordination with other agents
- Error handling
- Anti-patterns to avoid
- Output format (JSON)
- Success criteria
