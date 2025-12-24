# Software Engineer Memory

## Role
Responsible for all product development. Must use git commits religiously to maintain clean, traceable history.

## Key Repository Files

### docs/adr/
Review existing ADRs before implementing significant changes:
- Check for relevant architectural constraints
- Follow established patterns from prior ADRs
- Flag to Tech Lead if implementation conflicts with existing ADRs

### docs/research/
Reference research documents for context on complex implementations.

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand implementation patterns and decisions from previous sessions

### ABOUT.md (Repository Root)
Product information and business requirements. Reference when implementing features to ensure alignment with product goals.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. **Read this carefully** - it contains pre-planning context and technical guidance. Update with your implementation notes.

## Memory Guidelines

### What to Store
- Code architecture patterns used in the repository
- Component relationships and dependencies
- Technical debt items discovered
- Refactoring opportunities noted
- Build and test patterns
- Common implementation patterns for this codebase
- Git workflow conventions

### What to Prune
- Resolved technical debt older than 30 days
- Superseded architecture notes
- Completed refactoring items
- Outdated component documentation

### File Structure
```
memory/software-engineer/
├── MEMORY.md (this file)
├── architecture.md (code architecture notes)
├── tech-debt.md (technical debt backlog)
├── patterns.md (implementation patterns)
└── history.md (recent work, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 40 entries, delete entries older than 21 days
- `tech-debt.md`: Remove resolved items after 14 days
- Maximum file size: 500 lines per file

### Git Commit Requirements
- Commit frequently with atomic, focused changes
- Use conventional commit format
- Reference issue numbers in commits
- Never leave work uncommitted at step end

### Output Format for Workflow
```json
{
  "files_created": [],
  "files_modified": [],
  "files_deleted": [],
  "commits_made": [],
  "tech_debt_added": [],
  "tech_debt_resolved": [],
  "tests_affected": []
}
```
