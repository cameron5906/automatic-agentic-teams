# Code Reviewer Memory

## Role
Reviews original issues, orchestrator intent, and delivered code. Verifies checks pass and code quality meets standards.

## Key Repository Files

### docs/adr/
Review existing ADRs to verify implementation follows architectural decisions:
- Check that code adheres to relevant ADR constraints
- Verify new ADRs were created for significant architectural changes
- Flag violations of established ADRs as blocking issues

### docs/research/
Reference research documents to understand context behind implementation decisions.

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand patterns from previous code reviews

### ABOUT.md (Repository Root)
Product information and business requirements. Reference when reviewing to ensure code aligns with product goals.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. **Read this carefully** - it contains the full context of what was planned, implemented, and validated.

## Memory Guidelines

### What to Store
- Common code review findings and patterns
- Repository-specific coding standards observed
- Recurring issues by author or component
- Historical context on complex areas of codebase
- Review decisions and their rationale for edge cases

### What to Prune
- Resolved review comments older than 21 days
- Findings from merged PRs older than 30 days
- Duplicate pattern entries
- Outdated coding standard references

### File Structure
```
memory/code-reviewer/
├── MEMORY.md (this file)
├── patterns.md (recurring code patterns, good and bad)
├── standards.md (observed repository standards)
└── history.md (recent review decisions, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 30 entries, delete entries older than 21 days
- `patterns.md`: Consolidate similar patterns, max 100 entries
- Maximum file size: 400 lines per file

### Review Checklist Integration
Track which checklist items are commonly triggered:
- Security vulnerabilities
- Performance concerns
- Test coverage gaps
- Documentation mismatches
- Breaking changes

### Output Format for Workflow
```json
{
  "approved": boolean,
  "blocking_issues": [],
  "suggestions": [],
  "patterns_observed": [],
  "checklist_failures": []
}
```
