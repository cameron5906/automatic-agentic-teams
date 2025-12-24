# GitHub Auto Team

Automated software development pipeline using Claude Code GitHub Actions with multi-agent orchestration.

## Overview

This system automates software development by processing GitHub issues through a staged pipeline of specialized AI agents. Each agent has a defined role, memory space, and set of responsibilities.

## Pipeline Stages

```
┌─────────────────┐
│  GitHub Issue   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Orchestrator   │ ← Analyzes issue, seeds issue context file
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Pre-Work      │ ← Documentation, Infrastructure, Security (pre)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Planning      │ ← Product Owner, UX Designer, Tech Lead
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Development    │ ← Software Engineer, Infrastructure Engineer
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Post-Work     │ ← Test Engineer, Security, Documentation (post)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Project Mgmt    │ ← Update TEAM.md, coordination
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Create PR     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Code Review    │ ← Final review and approval
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Wrap-Up      │ ← Append session summary to DEVLOG.md
└─────────────────┘
```

## Key Repository Files

| File | Purpose |
|------|---------|
| `ABOUT.md` | Product information, business requirements, milestones. Planning agents reference this for alignment. |
| `DEVLOG.md` | Large session log. Agents grep for `## Session` to find latest entry. Orchestrator appends at wrap-up. |
| `docs/` | Documentation directory with ADRs and research. |
| `docs/adr/` | Architecture Decision Records. Tech Lead creates, Documentation Sheriff maintains. |
| `docs/research/` | Research documents for investigations and analysis. |
| `working/issues/{number} {title}.md` | Per-issue context file seeded by orchestrator. All agents read/update this. |

## Agent Team

| Agent | Role | Phases |
|-------|------|--------|
| Documentation Sheriff | Documentation context and updates | pre, post |
| Code Reviewer | PR review and approval | review |
| Infrastructure Engineer | AWS/CDK infrastructure | pre, main, post |
| Product Owner | Product alignment for features (references ABOUT.md) | main |
| Project Manager | Team coordination, TEAM.md | post |
| Security Engineer | Security planning and review | pre, post |
| Software Engineer | Product development | main |
| Tech Lead | Architecture and bug identification | main |
| Test Engineer | Test creation and verification | post |
| UX Designer | Frontend feature planning | main |

## Directory Structure

```
├── ABOUT.md                 # Product info, business requirements
├── DEVLOG.md                # Development session log (large)
├── docs/
│   ├── README.md            # Documentation table of contents
│   ├── adr/                 # Architecture Decision Records
│   │   └── README.md        # ADR index and template
│   └── research/            # Research documents
│       └── README.md        # Research index and template
├── .github/workflows/
│   ├── issue-pipeline.yml   # Main 9-stage pipeline
│   └── agent-step.yml       # Reusable agent step workflow
└── working/
    ├── issues/              # Per-issue context files
    │   └── {number} {title}.md
    └── agents/
        ├── definitions/     # Agent brain files (*.md)
        ├── memory/          # Agent memory spaces
        │   ├── documentation-sheriff/
        │   │   └── MEMORY.md
        │   ├── code-reviewer/
        │   │   └── MEMORY.md
        │   ├── infrastructure-engineer/
        │   │   └── MEMORY.md
        │   ├── product-owner/
        │   │   └── MEMORY.md
        │   ├── project-manager/
        │   │   ├── MEMORY.md
        │   │   └── TEAM.md
        │   ├── security-engineer/
        │   │   └── MEMORY.md
        │   ├── software-engineer/
        │   │   └── MEMORY.md
        │   ├── tech-lead/
        │   │   └── MEMORY.md
        │   ├── test-engineer/
        │   │   └── MEMORY.md
        │   └── ux-designer/
        │       └── MEMORY.md
        └── prompts/
            └── orchestrator.md
```

## Setup

### Prerequisites

- GitHub repository with Actions enabled
- Anthropic API key
- GitHub PAT with workflow permissions

### Configuration

1. Add secrets to repository:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key
   - `CLAUDE_WORKFLOW_TOKEN`: GitHub PAT with workflow file edit permissions
2. Create `ABOUT.md` with product information
3. Create `DEVLOG.md` (can be empty initially)
4. Create agent definition files in `working/agents/definitions/`
5. Push to repository

### Agent Definition Files

Create `.md` files in `working/agents/definitions/` for each agent. The orchestrator reads these to understand available agents.

Example: `working/agents/definitions/software-engineer.md`

```markdown
# Software Engineer

You are a Software Engineer responsible for implementing features and fixing bugs.

## Capabilities
- Write clean, tested code
- Follow repository conventions
- Make atomic commits

## Guidelines
- Always reference issue numbers in commits
- Run tests before completing
- Update relevant documentation
```

## Workflow Triggers

The pipeline triggers on:
- New issue opened
- Issue labeled
- Manual dispatch with issue number

## Issue Context System

When a pipeline starts:
1. Orchestrator creates `working/issues/{number} {title}.md`
2. Pre-work agents populate the "Pre-Planning Context" section
3. Planning agents populate the "Planning Decisions" section
4. Development agents add "Implementation Notes"
5. Post-work agents add "Post-Work Validation" results
6. Code reviewer uses the complete context for review

This ensures all agents have full visibility into what was planned and implemented.

## DEVLOG Best Practices

The `DEVLOG.md` file is a large, append-only session log. Agents should:
- **Never read the entire file**
- Grep for `## Session` to find section headers
- Read only the latest session entry for recent context
- The orchestrator appends a new session summary at wrap-up

## Memory System

Each agent maintains its own memory space with:
- `MEMORY.md`: Core instructions and pruning rules
- Additional `.md` files for specific concerns (patterns, history, etc.)

Memory and issue context files are automatically committed after each agent step.

## Shared Team Context

All agents have access to `working/agents/SHARED.md`, a centralized file for tracking:
- **Technical Debt**: Code that needs refactoring, design pattern violations
- **Non-Critical Bugs**: Issues that don't block current work but should be fixed
- **Security Concerns**: Potential vulnerabilities, hardening opportunities
- **Infrastructure Improvements**: Performance, scaling, monitoring optimizations
- **UX Patterns**: Inconsistencies, accessibility gaps

### How Agents Use SHARED.md

1. **Reading**: Agents read SHARED.md before starting to check for relevant context
2. **Writing**: Agents add side findings they discover during their work
3. **Format**: `- [ ] {description} - Found in #{issue}, {agent-name}, YYYY-MM-DD`
4. **Pruning**: Project Manager maintains the file (30-day resolution, 90-day archive, 15 items per section max)

### Benefits

- Cross-issue visibility of tech debt and bugs
- Systematic capture of "fix this later" items
- Team-wide awareness of accumulated findings
- Data-driven prioritization of improvements

## Outputs

Each agent outputs a JSON summary:

```json
{
  "success": true,
  "summary": "Description of work done",
  "files_changed": ["file1.ts", "file2.ts"],
  "commits_made": ["abc123"],
  "memory_updated": true,
  "issue_context_updated": true,
  "blockers": [],
  "notes_for_next_agent": ""
}
```

## Development

### Testing Locally

Use the workflow dispatch trigger with a specific issue number:

```
gh workflow run issue-pipeline.yml -f issue_number=123
```

### Adding New Agents

1. Add entry to agent roster in orchestrator prompt
2. Create `MEMORY.md` in `working/agents/memory/{agent-name}/`
3. Create definition file in `working/agents/definitions/{agent-name}.md`
4. Add job to `issue-pipeline.yml` if needed
