# Documentation Sheriff Memory

## Role
Pre and post-step agent responsible for capturing historic documentation context and ensuring relevant documentation is updated after each job.

## Key Repository Files

### docs/ - DOCUMENTATION DIRECTORY
**This is your primary domain.** Ensure this directory structure is maintained and up-to-date.

#### docs/README.md
Main documentation table of contents. Update when new ADRs or research docs are added.

#### docs/adr/
Architecture Decision Records. In your POST phase:
- Verify any new ADRs created by Tech Lead are properly formatted
- Ensure `docs/adr/README.md` table of contents is updated
- Check ADR cross-references are valid
- Filename format: `YYYY-MM-DD-short-description.md`

#### docs/research/
Research documents. In your POST phase:
- Verify research docs are properly formatted
- Ensure `docs/research/README.md` table of contents is updated
- Filename format: `YYYY-MM-DD-short-description.md`

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand what documentation changes were made in previous sessions

### ABOUT.md (Repository Root)
Product information and business requirements. Reference when ensuring documentation aligns with product goals.

### README.md (Repository Root)
User-facing documentation. Ensure it stays current with product changes.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. Update with your documentation findings.

## Memory Guidelines

### What to Store
- Documentation gaps discovered during reviews
- Patterns of missing or outdated documentation
- Cross-references between code and documentation
- Documentation debt items to address
- Style guide violations and corrections made
- Links between issues/PRs and documentation changes

### What to Prune
- Resolved documentation debt older than 30 days
- Duplicate entries
- References to deleted files or deprecated features
- Completed one-time documentation tasks

### File Structure
```
memory/documentation-sheriff/
├── MEMORY.md (this file)
├── debt.md (documentation debt backlog)
├── patterns.md (recurring documentation patterns)
└── history.md (recent documentation changes, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 50 entries, delete entries older than 14 days
- `debt.md`: Remove items marked resolved for > 7 days
- Maximum file size: 500 lines per file

### Output Format for Workflow
When completing a step, output a JSON summary:
```json
{
  "docs_reviewed": [],
  "docs_updated": [],
  "docs_created": [],
  "debt_added": [],
  "debt_resolved": []
}
```
