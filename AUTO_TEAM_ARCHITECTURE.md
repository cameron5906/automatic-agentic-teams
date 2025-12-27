# GitHub Auto Team - System Architecture

**Version:** 1.0
**Last Updated:** 2024-12-24
**Status:** Production Ready

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Pipeline Stages](#pipeline-stages)
4. [Context Flow Architecture](#context-flow-architecture)
5. [Agent Coordination](#agent-coordination)
6. [File System Architecture](#file-system-architecture)
7. [GitHub Actions Integration](#github-actions-integration)
8. [Discord Integration](#discord-integration)
9. [Memory & State Management](#memory--state-management)
10. [Quality Gates & Review](#quality-gates--review)
11. [Design Decisions & Trade-offs](#design-decisions--trade-offs)
12. [Security Architecture](#security-architecture)
13. [Scalability & Performance](#scalability--performance)
14. [Future Architecture Considerations](#future-architecture-considerations)

---

## System Overview

### Purpose

GitHub Auto Team is an autonomous software development pipeline that processes GitHub issues through a multi-agent system. Specialized AI agents collaborate to implement features, fix bugs, and maintain code quality without human intervention.

### Core Principles

1. **Autonomy**: Agents work independently with minimal human intervention
2. **Specialization**: Each agent has a focused responsibility and expertise
3. **Context Preservation**: Information flows seamlessly between agents
4. **Quality First**: Multiple validation layers ensure code quality
5. **Transparency**: All decisions and actions are logged and traceable

### Key Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                        │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐             │
│  │   Issues   │─▶│  Workflows  │─▶│  Pull Requests│             │
│  └────────────┘  └─────────────┘  └──────────────┘             │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code Actions (CI/CD)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              9-Stage Pipeline Orchestration              │   │
│  │  Orchestrate → Pre → Plan → Dev → Post → PM → PR → CR   │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       10 Specialized Agents                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Tech Lead │  │  Sec Eng │  │   Infra  │  │ Product  │  ...   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Persistence Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Issue Context│  │  Agent Memory│  │   SHARED.md  │          │
│  │    Files     │  │              │  │  (Tech Debt) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Integrations                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Discord    │  │  Anthropic   │  │     AWS      │          │
│  │  Webhooks    │  │     API      │  │   Fargate    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GitHub Issues UI  │  Pull Requests  │  Discord Channels │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              GitHub Actions Workflows                     │   │
│  │  • issue-pipeline.yml (9 stages)                          │   │
│  │  • agent-step.yml (reusable step template)               │   │
│  │  • issue-discord-relay.yml (notifications)               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT LAYER                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  10 Specialized AI Agents (Claude Sonnet 4)              │   │
│  │  • Each with own definition, memory, and tools            │   │
│  │  • ReAct pattern for reasoning and action                 │   │
│  │  • Phase-specific behavior (PRE/MAIN/POST/REVIEW)        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CONTEXT LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Context Management System                                │   │
│  │  • Issue Context Files (per-issue state)                  │   │
│  │  • Agent Memory (persistent learning)                     │   │
│  │  • Shared Context (cross-issue findings)                  │   │
│  │  • DEVLOG.md (session history)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Git Repository (Version Control)                         │   │
│  │  • All context committed to main branch                   │   │
│  │  • Atomic commits per agent step                          │   │
│  │  • Full audit trail via git history                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stages

### Stage 1: Orchestrate

**Purpose:** Analyze the issue and determine which agents to activate.

**Flow:**
```
GitHub Issue
    │
    ▼
┌─────────────────────────────────────────┐
│  Orchestrator (Claude Sonnet 4)         │
│  • Reads issue title, body, labels      │
│  • Loads all agent definitions          │
│  • Analyzes scope and complexity        │
│  • References ABOUT.md for product ctx  │
│  • Greps DEVLOG.md for recent context   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Creates Issue Context File             │
│  working/issues/{number} {title}.md     │
│  • Original issue details               │
│  • Empty sections for each phase        │
│  • Commits to repository                │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Outputs Delegation JSON                │
│  {                                       │
│    "activate_tech_lead": true,          │
│    "activate_security_engineer": false, │
│    "agent_prompts": {                   │
│      "tech-lead": "Analyze bug in..."   │
│    }                                     │
│  }                                       │
└─────────────────────────────────────────┘
```

**Key Outputs:**
- `issue_context`: Brief summary passed to all agents
- `delegation`: JSON with activation flags for each agent
- `agent_prompts`: Specific task instructions per agent
- `issue_file`: Path to created context file

### Stage 2: Pre-Work

**Purpose:** Gather context before implementation begins.

**Agents Activated (conditionally):**
```
┌─────────────────────────────────────────┐
│  Documentation Sheriff                  │
│  • Scans existing documentation         │
│  • Identifies relevant docs/ADRs        │
│  • Flags documentation gaps             │
│  • Updates issue context                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Infrastructure Engineer (if needed)    │
│  • Reviews current infrastructure       │
│  • Identifies infrastructure risks      │
│  • Notes deployment considerations      │
│  • Updates issue context                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Security Engineer (if needed)          │
│  • Reviews security-sensitive areas     │
│  • Defines security requirements        │
│  • Flags potential vulnerabilities      │
│  • Updates issue context                │
└─────────────────────────────────────────┘
```

**Output:** Issue context file updated with pre-planning sections.

### Stage 3: Planning

**Purpose:** Design the technical approach.

**Agents Activated (conditionally):**
```
┌─────────────────────────────────────────┐
│  Product Owner (for features)           │
│  • Defines acceptance criteria          │
│  • Validates product alignment          │
│  • References ABOUT.md                  │
│  • Updates issue context                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  UX Designer (for frontend)             │
│  • Plans user flows                     │
│  • Defines component structure          │
│  • Ensures accessibility                │
│  • Updates issue context                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Tech Lead (always for non-trivial)    │
│  • Designs technical approach           │
│  • Creates ADRs for decisions           │
│  • Identifies bugs and root causes      │
│  • Provides engineer guidance           │
│  • Updates issue context                │
└─────────────────────────────────────────┘
```

**Planning Context Passed to Development:**
```yaml
planning_context: |
  Product Owner: {result or 'Not activated'}
  UX Designer: {result or 'Not activated'}
  Tech Lead: {result or 'Not activated'}
```

### Stage 4: Development

**Purpose:** Implement the changes.

**Agents Activated (conditionally):**
```
┌─────────────────────────────────────────┐
│  Software Engineer (most issues)        │
│  • Reads issue context for guidance     │
│  • Implements code changes              │
│  • Writes tests                         │
│  • Makes atomic git commits             │
│  • Updates issue context                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Infrastructure Engineer (infra issues) │
│  • Implements CDK/infrastructure code   │
│  • Updates deployment configs           │
│  • Tests infrastructure changes         │
│  • Makes atomic git commits             │
│  • Updates issue context                │
└─────────────────────────────────────────┘
```

**Development Flow:**
1. Read issue context file for all prior context
2. Read planning guidance from Tech Lead
3. Read agent memory for patterns/learnings
4. Read SHARED.md for relevant tech debt
5. Implement changes
6. Write tests
7. Commit changes with conventional commit messages
8. Update issue context with implementation notes

### Stage 5: Post-Work

**Purpose:** Validate, test, and document the changes.

**Agents Activated (conditionally):**
```
┌─────────────────────────────────────────┐
│  Test Engineer (if code changed)        │
│  • Verifies test coverage               │
│  • Runs test suite                      │
│  • Identifies flaky tests               │
│  • Updates issue context                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Security Engineer (if security-related)│
│  • Reviews for OWASP Top 10             │
│  • Verifies security requirements       │
│  • Checks dependency security           │
│  • Updates issue context                │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Documentation Sheriff (always)         │
│  • Updates documentation                │
│  • Updates ADR indexes                  │
│  • Verifies doc completeness            │
│  • Updates issue context                │
└─────────────────────────────────────────┘
```

### Stage 6: Project Management

**Purpose:** Update team tracking and tribal knowledge.

**Agent Activated:**
```
┌─────────────────────────────────────────┐
│  Project Manager (always)               │
│  • Updates TEAM.md with completion      │
│  • Tracks blockers                      │
│  • Captures tribal knowledge            │
│  • Prunes TEAM.md (14-day completions)  │
│  • Prunes SHARED.md (30-day resolved)   │
│  • Updates milestones                   │
│  • Updates issue context                │
└─────────────────────────────────────────┘
```

**TEAM.md Structure:**
```markdown
# Team Status
Last Updated: [timestamp]

## Current Sprint
- [ ] Job 1 - Assigned: agent - Status: in_progress
- [x] Job 2 - Assigned: agent - Status: completed

## Recent Completions (14 days)
- [2024-01-15] Issue #123: Feature - Software Engineer

## Active Blockers
- [2024-01-15] Waiting on API creds - Owner: Infrastructure Engineer

## Tribal Knowledge (top 20)
- Always run migrations before Lambda updates
```

### Stage 7: Create PR

**Purpose:** Create a pull request with all changes.

**Flow:**
```
┌─────────────────────────────────────────┐
│  GitHub API (via gh CLI)                │
│  • Creates branch if needed             │
│  • Pushes all commits                   │
│  • Creates PR with title and body       │
│  • Links to original issue              │
│  • Outputs PR number and URL            │
└─────────────────────────────────────────┘
```

**PR Body Format:**
```markdown
## Summary
- Bullet point summary from issue context

## Implementation
- Key changes made
- Files modified

## Testing
- Tests added/updated
- Test results

## Review Notes
- Areas of focus for review
- Known limitations

Closes #{issue_number}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Stage 8: Code Review

**Purpose:** Final quality gate before merge.

**Agent Activated:**
```
┌─────────────────────────────────────────┐
│  Code Reviewer (always if PR created)   │
│  • Reads FULL issue context file       │
│  • Reviews PR diff systematically       │
│  • Checks ADR compliance                │
│  • Validates test coverage              │
│  • Verifies security review             │
│  • Makes APPROVE/REJECT decision        │
│  • Updates issue context with findings  │
└─────────────────────────────────────────┘
```

**Review Checklist:**
- [ ] Requirements fully implemented
- [ ] ADR compliance verified
- [ ] Tests exist and pass
- [ ] No security vulnerabilities
- [ ] Breaking changes have migration path
- [ ] Build/lint passes

**Output Format:**
```json
{
  "approved": true,
  "review_status": "APPROVED",
  "blocking_issues": [],
  "suggestions": [...],
  "patterns_observed": [...],
  "summary": "Implementation follows all standards..."
}
```

**Soft STOP_GATE Behavior:**
- If `review_status: "REJECTED"`:
  - Wrap-up still proceeds
  - DEVLOG.md includes rejection prominently
  - PR remains open for human review
  - Pipeline shows as successful (soft failure)

### Stage 9: Wrap-Up

**Purpose:** Append session summary to DEVLOG.md.

**Flow:**
```
┌─────────────────────────────────────────┐
│  Orchestrator (final summary)           │
│  • Reads complete issue context file    │
│  • Greps DEVLOG.md for latest session   │
│  • Appends new session entry            │
│  • Includes code review status          │
│  • Lists all agents that participated   │
│  • Summarizes accomplishments           │
│  • Commits DEVLOG.md                    │
└─────────────────────────────────────────┘
```

**DEVLOG.md Entry Format:**
```markdown
## Session [2024-01-15 14:30 UTC]

### Issue #123: Add user authentication

**Agents Participated:** Tech Lead, Security Engineer, Software Engineer, Test Engineer, Code Reviewer

**Summary:**
Implemented JWT-based authentication with refresh tokens. Created ADR-015 for auth strategy. Added comprehensive test coverage.

**Code Review:** APPROVED

**PR:** #125

**Notable Decisions:**
- Chose JWT over session-based auth (see ADR-015)
- Implemented rate limiting on auth endpoints

**Files Changed:** 12 files, +450/-50 lines

---
```

---

## Context Flow Architecture

### Three-Level Context System

```
┌─────────────────────────────────────────────────────────────────┐
│                   LEVEL 1: Issue Context                         │
│  working/issues/{number} {title}.md                              │
│  • Scope: Single issue only                                      │
│  • Lifetime: Duration of issue processing                        │
│  • Writers: All activated agents                                 │
│  • Readers: All activated agents                                 │
│  • Purpose: Single source of truth for issue                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LEVEL 2: Agent Memory                          │
│  working/agents/memory/{agent-name}/MEMORY.md                    │
│  • Scope: Agent-specific, cross-issue                            │
│  • Lifetime: Persistent, pruned by agent                         │
│  • Writers: Single agent only                                    │
│  • Readers: Single agent only                                    │
│  • Purpose: Agent learning and patterns                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LEVEL 3: Shared Context                        │
│  working/agents/SHARED.md                                        │
│  • Scope: Team-wide, cross-issue                                 │
│  • Lifetime: Persistent, pruned by Project Manager              │
│  • Writers: All agents                                           │
│  • Readers: All agents                                           │
│  • Purpose: Tech debt, bugs, improvements                        │
└─────────────────────────────────────────────────────────────────┘
```

### Issue Context File Structure

```markdown
# Issue #{number}: {title}

**Author:** {author}
**Created:** {timestamp}
**Labels:** {labels}

## Original Description
{issue_body}

---

## Pre-Planning Context
_This section populated by pre-work agents._

### Documentation Context
[Documentation Sheriff findings]

### Infrastructure Context
[Infrastructure Engineer findings]

### Security Context
[Security Engineer findings]

---

## Planning Decisions
_This section populated by planning agents._

### Product Requirements
[Product Owner requirements]

### UX Design Notes
[UX Designer notes]

### Technical Approach
[Tech Lead guidance]

---

## Implementation Notes
_This section populated during development._

[Software Engineer / Infrastructure Engineer notes]

---

## Post-Work Validation
_This section populated by post-work agents._

### Test Coverage
[Test Engineer results]

### Security Review
[Security Engineer review]

### Documentation Updates
[Documentation Sheriff updates]

### Code Review
[Code Reviewer findings]
```

### Context Flow Diagram

```
Issue Created
    │
    ▼
┌─────────────────────────────────────────┐
│  Orchestrator creates Issue Context     │
│  (empty sections)                        │
└─────────────────────────────────────────┘
    │
    ├──────────────────────────────────┐
    │                                  │
    ▼                                  ▼
┌─────────────────┐          ┌─────────────────┐
│  PRE Agents     │          │  Each Agent     │
│  populate       │          │  reads SHARED.md│
│  sections       │          │  before starting│
└─────────────────┘          └─────────────────┘
    │                                  │
    ▼                                  ▼
┌─────────────────────────────────────────┐
│  PLANNING Agents read PRE context       │
│  and populate planning sections         │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  DEVELOPMENT Agents read ALL prior      │
│  context and implement                  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  POST Agents read everything and        │
│  validate implementation                │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  CODE REVIEWER reads complete context   │
│  and makes final decision               │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Any agent can update SHARED.md with    │
│  side findings discovered               │
└─────────────────────────────────────────┘
```

### Shared Context (SHARED.md) Architecture

**Purpose:** Cross-issue visibility of technical debt and improvements.

**Structure:**
```markdown
# Shared Team Context

**Last Updated:** [auto-updated by agents]

## Technical Debt
- [ ] {description} - Found in #{issue}, {agent}, YYYY-MM-DD

## Non-Critical Bugs
- [ ] {description} - Found in #{issue}, {agent}, YYYY-MM-DD

## Security Concerns
- [ ] {description} - Found in #{issue}, {agent}, YYYY-MM-DD

## Infrastructure Improvements
- [ ] {description} - Found in #{issue}, {agent}, YYYY-MM-DD

## UX Patterns to Standardize
- [ ] {description} - Found in #{issue}, {agent}, YYYY-MM-DD

## Archive
- [x] {resolved item} - Resolved in #{issue}, YYYY-MM-DD
```

**Pruning Rules (Project Manager):**
- Resolved items >30 days → Archive
- Archived items >90 days → Delete
- Max 15 open items per section → Archive oldest
- Max 50 items in Archive total

**Agent Workflow:**
1. Read SHARED.md before starting work
2. Check for relevant context
3. If side finding discovered:
   - Add to appropriate section
   - Update "Last Updated" timestamp
   - Commit separately: `chore: update shared context with side findings`

---

## Agent Coordination

### Agent Roster

| Agent | Phases | Primary Tools | Memory Files |
|-------|--------|---------------|--------------|
| **Documentation Sheriff** | PRE, POST | Grep, Read, Edit | MEMORY.md, debt.md |
| **Code Reviewer** | REVIEW | Grep, Read, Diff | MEMORY.md, patterns.md |
| **Infrastructure Engineer** | PRE, MAIN, POST | AWS CLI, CDK, Bash | MEMORY.md, infra-patterns.md |
| **Product Owner** | MAIN | Read, Grep ABOUT.md | MEMORY.md, feature-requests.md |
| **Project Manager** | POST | Edit TEAM.md, Read | MEMORY.md, TEAM.md |
| **Security Engineer** | PRE, POST | Grep, npm audit | MEMORY.md, vulnerabilities.md |
| **Software Engineer** | MAIN | Read, Write, Edit, Bash | MEMORY.md |
| **Tech Lead** | MAIN | Grep, Read, Write ADRs | MEMORY.md, decisions.md |
| **Test Engineer** | POST | Bash (test runner), Grep | MEMORY.md, flaky.md |
| **UX Designer** | MAIN | Read, Grep components | MEMORY.md, patterns.md |

### Phase Assignment Matrix

```
┌──────────────────────────────────────────────────────────────────┐
│  PHASE        │  Agents Eligible                                 │
├──────────────────────────────────────────────────────────────────┤
│  PRE          │  Documentation Sheriff                           │
│               │  Infrastructure Engineer (conditional)           │
│               │  Security Engineer (conditional)                 │
├──────────────────────────────────────────────────────────────────┤
│  MAIN         │  Product Owner (features)                        │
│  (Planning)   │  UX Designer (frontend)                          │
│               │  Tech Lead (non-trivial)                         │
├──────────────────────────────────────────────────────────────────┤
│  MAIN         │  Software Engineer (most issues)                 │
│  (Development)│  Infrastructure Engineer (infra issues)          │
├──────────────────────────────────────────────────────────────────┤
│  POST         │  Test Engineer (if code changed)                 │
│               │  Security Engineer (if security-related)         │
│               │  Documentation Sheriff (always)                  │
├──────────────────────────────────────────────────────────────────┤
│  PROJECT-MGMT │  Project Manager (always)                        │
├──────────────────────────────────────────────────────────────────┤
│  REVIEW       │  Code Reviewer (if PR created)                   │
└──────────────────────────────────────────────────────────────────┘
```

### Agent Communication Pattern

**Direct Communication:** None (agents don't directly communicate)

**Indirect Communication:** Through shared files
```
Agent A writes to Issue Context
    │
    ▼
File committed to repository
    │
    ▼
Agent B reads Issue Context
    │
    ▼
Agent B sees Agent A's findings
```

**Coordination Mechanism:**
1. **Sequential Phases:** PRE → PLANNING → DEVELOPMENT → POST
2. **Conditional Activation:** Orchestrator decides which agents run
3. **Context Accumulation:** Each agent adds to growing context
4. **Final Review:** Code Reviewer sees complete picture

### Agent Step Template (agent-step.yml)

**Inputs:**
- `agent_name`: Which agent to run
- `phase`: PRE | MAIN | POST | REVIEW
- `issue_number`: Issue being processed
- `issue_context`: Brief summary
- `agent_prompts`: Specific task from orchestrator
- `planning_context`: Results from planning agents (if MAIN phase)
- `pr_number`: PR number (if REVIEW phase)

**System Prompt Assembly:**
```yaml
system_prompt: |
  You are the {agent_name} agent.
  Phase: {phase}

  # Agent Definition
  {content from working/agents/definitions/{agent_name}.md}

  # Agent Memory
  {content from working/agents/memory/{agent_name}/MEMORY.md}
  {content from all other .md files in memory directory}

  # Issue Context
  The issue context file is at: {issue_file_path}
  Brief summary: {issue_context}

  # Planning Context (if MAIN phase)
  {planning_context}

  # Your Task
  {agent_prompts[agent_name] or generic phase instructions}

  # Phase-Specific Instructions
  {PRE: gather context, update memory, update issue context}
  {MAIN: read issue context, execute task, commit changes}
  {POST: read issue context, validate work, update docs}
  {REVIEW: read full context, review PR, approve/reject}
```

**Post-Execution:**
1. Auto-commit agent memory changes
2. Auto-commit issue context changes
3. Output agent result JSON

---

## File System Architecture

### Repository Structure

```
github-auto-team/
├── .github/
│   └── workflows/
│       ├── issue-pipeline.yml         # Main 9-stage orchestration
│       ├── agent-step.yml             # Reusable agent executor
│       ├── deploy-discord-bot.yml     # AWS Fargate deployment
│       ├── issue-discord-relay.yml    # Discord notifications
│       └── ci-tools.yml               # Tool CI/CD
│
├── tools/
│   ├── discord-product-bot/           # Always-on Discord bot
│   │   ├── Dockerfile
│   │   ├── src/
│   │   └── package.json
│   └── mcp-discord/                   # MCP server for Discord
│       ├── src/
│       └── package.json
│
├── docs/
│   ├── README.md                      # Documentation index
│   ├── adr/                           # Architecture Decision Records
│   │   ├── README.md                  # ADR index + template
│   │   └── YYYY-MM-DD-title.md
│   └── research/                      # Research documents
│       ├── README.md                  # Research index + template
│       └── topic-name.md
│
├── working/
│   ├── issues/                        # Per-issue context files
│   │   └── {number} {title}.md        # Created by orchestrator
│   └── agents/
│       ├── SHARED.md                  # Shared team context
│       ├── definitions/               # Agent behavior definitions
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
│       ├── memory/                    # Agent persistent memory
│       │   ├── code-reviewer/
│       │   │   ├── MEMORY.md
│       │   │   └── patterns.md
│       │   ├── documentation-sheriff/
│       │   │   ├── MEMORY.md
│       │   │   └── debt.md
│       │   ├── software-engineer/
│       │   │   └── MEMORY.md
│       │   ├── test-engineer/
│       │   │   ├── MEMORY.md
│       │   │   └── flaky.md
│       │   └── {agent-name}/
│       │       └── MEMORY.md
│       └── prompts/
│           └── orchestrator.md        # Orchestrator guidelines
│
├── ABOUT.md                           # Product info, business reqs
├── DEVLOG.md                          # Session history (large)
├── CLAUDE.md                          # Project instructions
├── README.md                          # Project documentation
├── SETUP.md                           # Setup guide
└── AUTO_TEAM_ARCHITECTURE.md          # This file
```

### File Ownership Matrix

| File/Directory | Created By | Updated By | Pruned By |
|----------------|------------|------------|-----------|
| `working/issues/*.md` | Orchestrator | All agents | Manual (closed issues) |
| `working/agents/SHARED.md` | Manual (initial) | All agents | Project Manager |
| `working/agents/memory/{agent}/` | Manual (initial) | Single agent | Single agent |
| `DEVLOG.md` | Manual (initial) | Orchestrator (wrap-up) | Never (append-only) |
| `TEAM.md` | Project Manager | Project Manager | Project Manager |
| `docs/adr/*.md` | Tech Lead | Documentation Sheriff | Manual |
| `docs/research/*.md` | Any agent | Documentation Sheriff | Manual |

### Commit Strategy

**Atomic Commits:** One logical change per commit

**Commit Messages:** Conventional Commits format
```
<type>(<scope>): <description>

[optional body]

Refs: #<issue-number>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Test additions/modifications
- `chore`: Maintenance (memory updates, context updates)

**Auto-Commit Points:**
1. After orchestrator seeds issue context
2. After each agent completes (memory + issue context)
3. After wrap-up appends to DEVLOG.md
4. After PR creation

**Example Commit Flow for Issue #123:**
```
1. "chore: seed issue context and docs for #123"
2. "chore(tech-lead): update agent memory and issue context [PLANNING]"
3. "feat(auth): implement JWT authentication

   - Add JWT token generation
   - Implement refresh token rotation
   - Add rate limiting to auth endpoints

   Refs: #123"
4. "test(auth): add authentication test coverage

   Refs: #123"
5. "chore(test-engineer): update agent memory and issue context [POST]"
6. "docs: update authentication ADR and README

   Refs: #123"
7. "chore(documentation-sheriff): update agent memory and issue context [POST]"
8. "chore(project-manager): update TEAM.md and shared context [PROJECT-MGMT]"
9. "chore: append session summary to DEVLOG.md for #123"
```

---

## GitHub Actions Integration

### Workflow Trigger Mechanism

```
┌─────────────────────────────────────────┐
│  Trigger Events                         │
│  • issues (opened)                      │
│  • issues (labeled: work-on-this)       │
│  • workflow_dispatch (manual)           │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  issue-pipeline.yml starts              │
│  Runs on: ubuntu-latest                 │
└─────────────────────────────────────────┘
```

### Job Dependency Graph

```
orchestrate
    │
    ├──────────────────────────────────┐
    │                                  │
    ▼                                  ▼
pre-documentation              pre-infrastructure
    │                                  │
    ├──────────────┐                   │
    │              │                   │
    ▼              ▼                   ▼
planning-product   planning-ux        pre-security
    │              │                   │
    └──────┬───────┴───────────────────┘
           │
           ▼
    planning-tech-lead
           │
           ├──────────────────┐
           │                  │
           ▼                  ▼
    development-software    development-infrastructure
           │                  │
           └──────┬───────────┘
                  │
                  ├──────────────────┐
                  │                  │
                  ▼                  ▼
            post-test         post-security
                  │                  │
                  ├────────┬─────────┘
                  │        │
                  ▼        ▼
            post-documentation
                  │
                  ▼
            project-management
                  │
                  ▼
              create-pr
                  │
                  ▼
             code-review
                  │
                  ▼
               wrap-up
```

### Conditional Execution Pattern

**Each agent job uses:**
```yaml
needs: [orchestrate, previous-phase-jobs]
if: |
  always() &&
  needs.orchestrate.result == 'success' &&
  needs.orchestrate.outputs.activate_{agent} == 'true' &&
  (needs.previous-job.result == 'success' || ...)
```

**Key Points:**
- `always()`: Don't skip if sibling jobs fail
- Check orchestrate succeeded
- Check agent is activated
- Check required dependencies succeeded
- Allow optional dependencies to fail

### Secrets Management

**GitHub Secrets:**
```
ANTHROPIC_API_KEY          # Claude API access
CLAUDE_WORKFLOW_TOKEN      # GitHub PAT (workflow permissions)
DISCORD_DEV_WEBHOOK_URL    # Discord webhook for notifications
AWS_ROLE_ARN              # IAM role for OIDC (optional)
DISCORD_BOT_TOKEN         # Discord bot token (optional)
OPENAI_API_KEY            # OpenAI API for relay (optional)
```

**Secret Usage:**
- Passed to actions via `secrets: inherit`
- Never logged or exposed in outputs
- Rotated according to security policy

### GitHub Token Permissions

**GITHUB_TOKEN (built-in):**
- Read repository contents
- Read issues
- Create comments

**CLAUDE_WORKFLOW_TOKEN (PAT):**
- Read/write repository contents
- Read/write issues
- Read/write pull requests
- Read/write workflows (for modifying workflow files)

**Why PAT Needed:**
- GITHUB_TOKEN cannot modify workflow files
- GITHUB_TOKEN has limited PR permissions
- PAT allows full automation

---

## Discord Integration

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Discord Integration                          │
│                                                                   │
│  ┌──────────────────────┐       ┌──────────────────────┐        │
│  │   Webhook System     │       │   Discord Bot        │        │
│  │   (Stateless)        │       │   (Stateful)         │        │
│  └──────────────────────┘       └──────────────────────┘        │
│           │                              │                       │
│           ▼                              ▼                       │
│  ┌──────────────────────┐       ┌──────────────────────┐        │
│  │ issue-discord-relay  │       │  AWS Fargate Task    │        │
│  │ (GitHub Actions)     │       │  discord-product-bot │        │
│  │ • Issue events       │       │  • Always running    │        │
│  │ • Comment events     │       │  • Monitors channels │        │
│  │ • GPT-4o summaries   │       │  • Creates issues    │        │
│  └──────────────────────┘       │  • State in EFS      │        │
│           │                      └──────────────────────┘        │
│           │                              │                       │
└───────────┼──────────────────────────────┼───────────────────────┘
            │                              │
            ▼                              ▼
      #dev channel                   #product channel
```

### Webhook System (Stateless)

**Purpose:** Notify Discord of issue pipeline events

**Trigger:** GitHub issue/comment events

**Flow:**
```
GitHub Event
    │
    ▼
┌─────────────────────────────────────────┐
│  issue-discord-relay.yml workflow       │
│  • Filters for relevant events          │
│  • Calls GPT-4o for friendly summary    │
│  • Posts to DISCORD_DEV_WEBHOOK_URL     │
└─────────────────────────────────────────┘
    │
    ▼
Discord #dev Channel
```

**Message Format:**
```
## Issue #123: Add authentication

The team just started working on adding JWT authentication.
Tech Lead is analyzing the architecture, and Security Engineer
is reviewing requirements. Stay tuned!

[View Issue](https://github.com/...)
```

### MCP Discord Server (Agent Tool)

**Purpose:** Allow agents to post updates during pipeline execution

**Architecture:**
```
┌─────────────────────────────────────────┐
│  Agent (during execution)               │
│  Uses: discord_post_dev_update tool     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  MCP Discord Server                     │
│  tools/mcp-discord/                     │
│  Built and loaded in agent-step.yml     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Discord Webhook                        │
│  DISCORD_DEV_WEBHOOK_URL                │
└─────────────────────────────────────────┘
```

**Tool Signature:**
```typescript
discord_post_dev_update(
  category: "tech_debt" | "progress" | "delay" | "thinking",
  message: string
)
```

**Example Usage in Agent:**
```
Agent thinks: "I've discovered a potential performance issue..."

Agent calls: discord_post_dev_update(
  category: "tech_debt",
  message: "Found N+1 query in user service - could impact scale"
)

Discord receives: "🔧 Tech Debt: Found N+1 query in user service..."
```

### Discord Bot (Stateful)

**Purpose:** Always-on presence for interactive conversations

**Deployment:**
- AWS Fargate (serverless containers)
- EFS for SQLite state persistence
- Auto-deploys on code changes to `tools/discord-product-bot/`

**Capabilities:**
- Monitor #product channel for feature requests
- Create GitHub issues from Discord conversations
- Track conversation context in SQLite
- Respond to user questions about the system

**Not Covered in This Architecture (optional component)**

---

## Memory & State Management

### Agent Memory Architecture

**Purpose:** Persistent learning and pattern recognition

**Structure:**
```
working/agents/memory/{agent-name}/
├── MEMORY.md              # Core memory and pruning rules
└── {optional}.md          # Agent-specific supplementary files
```

**MEMORY.md Template:**
```markdown
# {Agent Name} Memory

## Core Instructions
[Agent-specific persistent instructions]

## Pruning Rules
[How this agent prunes its own memory]

## Patterns Learned
[Key patterns this agent has identified]

## Recent Context
[Short-term memory, auto-pruned]
```

**Supplementary Files (examples):**
- Software Engineer: `tech-debt.md` (now uses SHARED.md instead)
- Test Engineer: `flaky.md`
- Documentation Sheriff: `debt.md` (now uses SHARED.md instead)
- Code Reviewer: `patterns.md`

**Memory Update Flow:**
```
Agent executes
    │
    ▼
Agent updates memory files
    │
    ▼
Workflow auto-commits
    │
    ▼
git commit -m "chore({agent}): update agent memory [PHASE]"
```

### State Persistence Strategy

**What Gets Persisted:**
1. **Issue Context:** Full state of issue processing
2. **Agent Memory:** Learnings and patterns
3. **Shared Context:** Cross-issue findings
4. **DEVLOG.md:** Complete session history
5. **TEAM.md:** Team status and tribal knowledge
6. **Code Changes:** All implementation work

**What Doesn't Get Persisted:**
- Workflow run logs (in GitHub Actions UI)
- Temporary files (cleaned up automatically)
- API responses (processed and discarded)

**Persistence Mechanism:**
- **Storage:** Git repository (version controlled)
- **Commits:** Atomic per agent step
- **Branches:** Main branch (no feature branches for pipeline)
- **History:** Full audit trail via git log

### DEVLOG.md Growth Management

**Challenge:** File grows unbounded (append-only)

**Current Strategy:**
- Grep for latest session: `grep -A 20 "## Session" DEVLOG.md | tail -40`
- Agents never read full file
- Orchestrator appends new sessions

**Future Consideration:**
- Archive sessions older than 6 months
- Create DEVLOG-archive-YYYY.md files
- Keep DEVLOG.md at manageable size

### Shared Context Pruning

**Managed By:** Project Manager (every pipeline run)

**Rules:**
```
Each Section (Tech Debt, Bugs, Security, Infrastructure, UX):
  • Resolved items >30 days → Archive
  • Sections with >15 items → Archive oldest

Archive Section:
  • Items >90 days → Delete
  • Max 50 items total
```

**Example Pruning:**
```
Before Pruning:
## Technical Debt (18 items)
- [ ] Item 1 (90 days old)
- [ ] Item 2 (60 days old)
- ...
- [x] Item 10 (45 days old, resolved)

After Pruning:
## Technical Debt (15 items)
- [ ] Item 2 (60 days old)
- ...
(3 oldest archived, 1 old resolved item archived)

## Archive
- [x] Item 10 - Resolved in #456, 2024-11-01
```

---

## Quality Gates & Review

### Quality Gate Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         QUALITY GATES                            │
├─────────────────────────────────────────────────────────────────┤
│  Gate 1: Orchestrator Analysis                                  │
│  • Validates issue is actionable                                │
│  • Ensures required context exists                              │
│  • Checks for duplicate/related issues                          │
├─────────────────────────────────────────────────────────────────┤
│  Gate 2: Pre-Work Validation                                    │
│  • Documentation Sheriff flags missing docs                     │
│  • Security Engineer identifies security requirements           │
│  • Infrastructure Engineer spots infrastructure risks           │
├─────────────────────────────────────────────────────────────────┤
│  Gate 3: Planning Review                                        │
│  • Tech Lead verifies architectural soundness                   │
│  • Product Owner validates product alignment                    │
│  • UX Designer ensures user experience quality                  │
├─────────────────────────────────────────────────────────────────┤
│  Gate 4: Implementation Quality                                 │
│  • Software Engineer follows coding standards                   │
│  • Commits are atomic and well-documented                       │
│  • Tests written alongside code                                 │
├─────────────────────────────────────────────────────────────────┤
│  Gate 5: Post-Work Validation                                   │
│  • Test Engineer verifies coverage and passing tests            │
│  • Security Engineer reviews for OWASP Top 10                   │
│  • Documentation Sheriff updates all docs                       │
├─────────────────────────────────────────────────────────────────┤
│  Gate 6: Code Review (FINAL GATE)                               │
│  • Code Reviewer validates all prior gates                      │
│  • Comprehensive checklist verification                         │
│  • APPROVE/REJECT decision                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Code Review Architecture

**Soft STOP_GATE Design:**

```
Code Review Completes
    │
    ├─────────────────┬─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
 APPROVED          REJECTED      CONDITIONAL
    │                 │                 │
    ▼                 ▼                 ▼
Wrap-up runs      Wrap-up runs    Wrap-up runs
    │                 │                 │
    ▼                 ▼                 ▼
DEVLOG shows      DEVLOG shows    DEVLOG shows
"APPROVED"        "REJECTED"      "CONDITIONAL"
    │                 │                 │
    ▼                 ▼                 ▼
PR ready for      PR needs work   Human decides
human merge       Human reviews   whether to merge
```

**Why Soft Instead of Hard STOP_GATE:**
- Allows human override for edge cases
- Preserves complete session history
- Enables learning from rejected work
- Maintains pipeline reliability (no false failures)

**Review Output Propagation:**
```yaml
code-review:
  outputs:
    review_status: ${{ steps.review.outputs.review_status }}
    approved: ${{ steps.review.outputs.approved }}

wrap-up:
  needs: [code-review]
  steps:
    - name: Include review status
      env:
        REVIEW_STATUS: ${{ needs.code-review.outputs.review_status }}
```

### Test Coverage Requirements

**Enforced By:** Test Engineer

**Requirements:**
- New code: Minimum 80% coverage
- Critical paths: 100% coverage
- Edge cases: Must be tested
- Integration tests: For API endpoints

**Verification:**
```bash
# Test Engineer runs
npm test -- --coverage
# OR
pytest --cov=src --cov-report=term

# Checks coverage thresholds
# Flags gaps in issue context
```

---

## Design Decisions & Trade-offs

### Key Architectural Decisions

#### 1. Sequential Phases vs. Parallel Agents

**Decision:** Sequential phases (PRE → PLANNING → DEV → POST)

**Rationale:**
- Planning agents need pre-work context
- Development agents need planning guidance
- Post-work agents need completed implementation
- Clear dependency chain reduces complexity

**Trade-off:**
- ✅ Pro: Predictable, easier to reason about
- ❌ Con: Slower than full parallelization
- ✅ Pro: Better context accumulation
- ❌ Con: One phase blocks next phase

#### 2. Single Issue Context File vs. Multiple Files

**Decision:** Single file per issue (`working/issues/{number} {title}.md`)

**Rationale:**
- Single source of truth
- Easier for agents to find and read
- Simpler git history (one file per issue)
- Natural structure with sections

**Trade-off:**
- ✅ Pro: Simple, predictable location
- ❌ Con: File can get large for complex issues
- ✅ Pro: Easy to grep and search
- ❌ Con: Potential merge conflicts (mitigated by sequential execution)

#### 3. Git Commits as Persistence vs. Database

**Decision:** Git repository as primary persistence layer

**Rationale:**
- Version control built-in
- Audit trail automatic
- No external database needed
- Works with GitHub Actions naturally
- Human-readable history

**Trade-off:**
- ✅ Pro: Free version control and audit trail
- ✅ Pro: No infrastructure overhead
- ❌ Con: Repository size growth over time
- ❌ Con: Not optimized for queries
- ✅ Pro: Human-readable diffs

#### 4. Soft STOP_GATE vs. Hard STOP_GATE

**Decision:** Soft STOP_GATE (continue to wrap-up even on rejection)

**Rationale:**
- Preserves complete session history
- Allows human review of rejection
- Enables learning from failed attempts
- More reliable (no false failures from overzealous review)

**Trade-off:**
- ✅ Pro: Complete audit trail always
- ❌ Con: Doesn't prevent bad code from being in PR
- ✅ Pro: Humans can override if needed
- ❌ Con: Extra manual review step
- ✅ Pro: Learn from mistakes

#### 5. Shared Context (SHARED.md) vs. Individual Memory Only

**Decision:** Add shared context file in addition to individual memory

**Rationale:**
- Cross-issue visibility needed
- Tech debt accumulates across issues
- Team-wide awareness important
- Individual memory insufficient for coordination

**Trade-off:**
- ✅ Pro: Cross-issue visibility
- ❌ Con: Additional file to maintain
- ✅ Pro: Systematic debt tracking
- ❌ Con: Requires pruning discipline
- ✅ Pro: Data-driven prioritization

#### 6. Anthropic API vs. Claude Pro OAuth

**Decision:** Support both, recommend API for production

**Rationale:**
- API: Reliable, long-lived tokens
- OAuth: Convenient for testing, requires refresh
- Different use cases for different users

**Trade-off:**
- API: Pay-per-use, predictable
- OAuth: Subscription-based, token expiration issues
- API: Better for production pipelines
- OAuth: Better for quick testing

---

## Security Architecture

### Secrets Management

**GitHub Secrets Storage:**
```
ANTHROPIC_API_KEY          # Encrypted at rest
CLAUDE_WORKFLOW_TOKEN      # Fine-grained PAT with minimal scope
DISCORD_DEV_WEBHOOK_URL    # Read-only webhook URL
```

**AWS Secrets (for Discord Bot):**
```
AWS Secrets Manager:
  • discord-bot-token
  • github-token
  • openai-api-key

Accessed via:
  • ECS Task Execution Role
  • IAM policies with least privilege
```

**Secret Rotation:**
- GitHub PATs: Rotate every 90 days
- API keys: Rotate per provider recommendation
- Webhooks: Rotate if compromised

### Access Control

**GitHub Actions:**
- Workflows can only access allowed secrets
- `secrets.inherit` explicitly required
- No secret exposure in logs

**Agent Permissions:**
- Agents cannot access GitHub secrets directly
- Secrets passed via environment variables
- No secrets written to files

### Threat Model

**Threats Mitigated:**
1. **Compromised API Key:**
   - Rate limiting at API provider level
   - GitHub secret rotation capability
   - Audit trail in git history

2. **Malicious Issue:**
   - No arbitrary code execution
   - Sandboxed Claude Code environment
   - All changes committed (auditable)

3. **Injection Attacks:**
   - No shell command injection (inputs sanitized)
   - No SQL injection (no database)
   - No XSS (generated code reviewed)

**Threats NOT Mitigated:**
4. **Social Engineering:**
   - Agents might implement malicious requirements if in issue
   - Code Reviewer provides layer of defense
   - Human review of PRs still required

5. **Resource Exhaustion:**
   - GitHub Actions limits apply (minutes, concurrency)
   - Anthropic API rate limits apply
   - No infinite loop protection in generated code

### Code Review Security

**Security Checklist (Code Reviewer):**
- [ ] No hardcoded secrets
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Input validation present
- [ ] Output encoding applied
- [ ] Authentication/authorization correct
- [ ] Dependency security verified

---

## Scalability & Performance

### Current Capacity

**GitHub Actions:**
- Public repos: Unlimited minutes
- Private repos: Plan-dependent (2000-50000 minutes/month)
- Concurrent workflows: 20-180 depending on plan

**Bottlenecks:**
1. **Sequential execution:** Phases block each other
2. **Anthropic API rate limits:** Model-dependent
3. **GitHub API rate limits:** 5000 requests/hour
4. **Workflow minutes:** Monthly budget

### Performance Optimization Strategies

#### 1. Conditional Agent Activation

```yaml
# Only run agent if orchestrator activated it
if: needs.orchestrate.outputs.activate_agent == 'true'
```

**Impact:**
- Saves ~50% of workflow minutes on simple issues
- Reduces API calls to Anthropic

#### 2. Parallel Execution Within Phases

```yaml
# Planning agents run in parallel
planning-product:
  needs: [orchestrate, pre-work]
planning-ux:
  needs: [orchestrate, pre-work]
planning-tech-lead:
  needs: [orchestrate, pre-work]
```

**Impact:**
- Reduces planning phase from 15min to 5min (3 agents)

#### 3. Caching

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Impact:**
- Faster npm install (~30s → 5s)

### Scaling Projections

**10 issues/day:**
- Workflow minutes: ~200 minutes/day
- Anthropic API: ~$5/day
- Manageable with current architecture

**100 issues/day:**
- Workflow minutes: ~2000 minutes/day
- Anthropic API: ~$50/day
- Would need optimizations:
  - More aggressive conditional activation
  - Smaller context windows
  - Faster models for simple tasks

**1000 issues/day:**
- Would need architectural changes:
  - Queue-based processing
  - Dedicated infrastructure
  - Rate limit management
  - Cost optimization critical

### Repository Size Growth

**Current Growth Rate:**
- ~100KB per issue (context file + commits)
- ~10MB per 100 issues
- Sustainable up to ~10,000 issues (~1GB)

**Mitigation Strategies:**
- Archive old issue context files
- Prune DEVLOG.md periodically
- Use Git LFS for large files (if needed)

---

## Future Architecture Considerations

### Potential Enhancements

#### 1. Parallel Agent Execution (Experimental)

**Current:** Sequential phases
**Future:** Independent agents in parallel

```
┌──────────────┐
│ Orchestrator │
└──────┬───────┘
       │
       ├─────────┬─────────┬─────────┐
       ▼         ▼         ▼         ▼
   Agent A   Agent B   Agent C   Agent D
       │         │         │         │
       └─────────┴─────────┴─────────┘
                   │
                   ▼
              Merge Results
```

**Challenges:**
- Context coordination
- Merge conflicts
- Dependency management

#### 2. Feedback Loops

**Current:** One-shot execution
**Future:** Iterative refinement

```
Orchestrate → Plan → Implement → Review
                ▲                   │
                │                   │
                └───── Iterate ─────┘
```

**Use Cases:**
- Code Reviewer requests changes
- Tests fail, Software Engineer fixes
- Security issues found, re-implement

#### 3. Human-in-the-Loop

**Current:** Fully autonomous
**Future:** Optional human approvals

```
Planning Complete
    │
    ▼
Notify Human → Await Approval
    │              │
    │              ▼
    └──────── Continue / Abort
```

**Use Cases:**
- High-risk changes (security, infrastructure)
- Large refactors
- Breaking changes

#### 4. Cost Optimization

**Strategies:**
- Use faster/cheaper models for simple tasks
- Implement result caching
- Smart context window management
- Batch similar issues

#### 5. Multi-Repository Support

**Current:** Single repository
**Future:** Cross-repository coordination

**Architecture:**
```
Central Orchestrator
    │
    ├─────────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼
  Repo A    Repo B    Repo C    Repo D
```

**Challenges:**
- Cross-repo dependencies
- Shared context management
- Deployment coordination

#### 6. Learning and Adaptation

**Concept:** Agents learn from outcomes

**Metrics to Track:**
- Code Review approval rate
- Test pass rate
- Bug reoccurrence
- Tech debt accumulation

**Adaptation:**
- Update agent definitions based on patterns
- Refine orchestrator delegation logic
- Improve quality thresholds

---

## Appendix: Technology Stack

### Core Technologies

| Component | Technology | Version |
|-----------|-----------|---------|
| **Orchestration** | GitHub Actions | Latest |
| **AI Model** | Claude Sonnet 4.5 | 2024-10-22 |
| **Agent Framework** | Claude Code Action | Beta |
| **Version Control** | Git | 2.x |
| **Language** | Markdown, YAML, TypeScript | - |
| **Notifications** | Discord Webhooks | v10 |
| **Optional: Bot** | AWS Fargate, ECS | Latest |

### Dependencies

**GitHub Actions:**
- `actions/checkout@v4`
- `anthropics/claude-code-action@beta`

**MCP Discord Server:**
- Node.js 18+
- TypeScript 5.x
- Discord.js 14.x

**Discord Product Bot:**
- Node.js 18+
- Discord.js 14.x
- SQLite 3.x
- AWS SDK v3

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **Agent** | Specialized AI with specific role and tools |
| **Orchestrator** | Initial analysis agent that delegates to specialists |
| **Issue Context** | Per-issue markdown file with accumulated context |
| **Agent Memory** | Persistent storage for agent learnings |
| **Shared Context** | Cross-issue file for tech debt and findings |
| **Phase** | Stage of pipeline (PRE/MAIN/POST/REVIEW) |
| **Soft STOP_GATE** | Review rejection that logs but doesn't halt |
| **ReAct Pattern** | Reasoning + Action pattern for agent behavior |
| **ADR** | Architecture Decision Record |
| **DEVLOG** | Development log (session history) |
| **MCP** | Model Context Protocol (for tool integration) |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-24 | Initial architecture document |

---

**END OF ARCHITECTURE DOCUMENT**
