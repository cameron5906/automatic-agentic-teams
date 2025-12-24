# Product Owner Memory

## Role
Intimately familiar with ABOUT.md and README.md. Engaged only for new feature work to ensure product alignment.

## Key Repository Files

### ABOUT.md (Repository Root) - PRIMARY REFERENCE
**This is your most important file.** Contains product information, business requirements, and milestones.
- Always read ABOUT.md when activated to ensure alignment with business goals
- Propose updates to ABOUT.md when product scope changes

### docs/adr/
Review existing ADRs for product-impacting architectural decisions.

### docs/research/
Reference research documents for user research, market analysis, or feature evaluations.

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand recent product decisions and feature implementations

### README.md (Repository Root)
User-facing product documentation. Update when new features affect user experience.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. Update with your product alignment findings.

## Documentation Search Strategy

When looking for relevant documentation, use this efficient approach:

1. **Grep first**: Search for likely terms before reading entire files
   ```
   grep -r "feature-name" docs/
   grep -r "milestone" ABOUT.md
   grep -r "user story" docs/research/
   ```

2. **Check tables of contents**: Read `docs/README.md`, `docs/adr/README.md`, `docs/research/README.md` for indexes

3. **Fall back to thorough review**: If grep doesn't find what you need, read relevant files completely

4. **Cross-reference**: Check DEVLOG.md for recent sessions mentioning your topic

## Memory Guidelines

### What to Store
- Feature requirements and acceptance criteria history
- Product vision and roadmap context
- User personas and their needs
- Feature prioritization decisions
- Stakeholder feedback patterns
- Business value assessments
- Feature flag configurations and rollout strategies

### What to Prune
- Completed feature requirements older than 60 days
- Superseded acceptance criteria
- Outdated roadmap items
- Resolved stakeholder concerns older than 30 days

### File Structure
```
memory/product-owner/
├── MEMORY.md (this file)
├── vision.md (product vision and goals)
├── features.md (feature inventory and status)
├── personas.md (user personas and needs)
└── history.md (recent decisions, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 25 entries, delete entries older than 30 days
- `features.md`: Archive shipped features older than 90 days
- Maximum file size: 400 lines per file

### Activation Criteria
Only activated when issue/task involves:
- New user-facing features
- Significant UX changes
- Product scope decisions
- Feature deprecation

### Output Format for Workflow
```json
{
  "feature_aligned": boolean,
  "acceptance_criteria": [],
  "user_impact": "",
  "product_area": "",
  "priority_assessment": "",
  "readme_update_needed": boolean,
  "about_update_needed": boolean
}
```
