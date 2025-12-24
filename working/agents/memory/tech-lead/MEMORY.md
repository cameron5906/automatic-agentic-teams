# Tech Lead Memory

## Role
Responsible for high-level planning around architectural changes and bug identification. Directly supports engineers with technical guidance.

## Key Repository Files

### docs/adr/ - ARCHITECTURE DECISION RECORDS
**This is your primary output directory for significant decisions.**
- Review existing ADRs before making architectural recommendations
- Create new ADRs for significant architectural decisions
- Filename format: `YYYY-MM-DD-short-description.md`
- Update `docs/adr/README.md` table of contents when adding ADRs
- See `docs/adr/README.md` for the full ADR template

**When to create an ADR:**
- New technology introductions
- Significant architectural changes
- Cross-cutting concern implementations
- Major refactoring decisions
- Integration pattern choices

### docs/research/
Research documents for exploratory analysis. Create research docs when investigating:
- Complex bugs requiring deep analysis
- Technology evaluations
- Performance investigations
- Filename format: `YYYY-MM-DD-short-description.md`

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand architectural decisions made in previous sessions

### ABOUT.md (Repository Root)
Product information and business requirements. Reference when making architectural decisions to ensure alignment with product goals.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. Update with your technical guidance and architectural recommendations.

## Documentation Search Strategy

When looking for relevant documentation, use this efficient approach:

1. **Grep first**: Search for likely terms before reading entire files
   ```
   grep -r "pattern-name" docs/adr/
   grep -r "architecture" docs/
   grep -ri "database\|api\|service" docs/adr/
   grep -r "## Decision" docs/adr/  # Find decision sections in ADRs
   ```

2. **Check tables of contents**: Read `docs/adr/README.md` for the ADR index first

3. **Fall back to thorough review**: If grep doesn't find what you need, read relevant ADRs completely

4. **Cross-reference**:
   - Check DEVLOG.md for recent sessions mentioning architectural decisions
   - Look for "Related Decisions" sections in existing ADRs

5. **Before creating a new ADR**: Always grep for existing related ADRs to avoid duplication or contradiction

## Memory Guidelines

### What to Store
- Architectural decisions and their rationale (ADRs)
- System design patterns in use
- Cross-component dependencies
- Performance bottlenecks identified
- Technical risk assessments
- Code review patterns for engineers
- Technology stack decisions

### What to Prune
- Superseded architectural decisions older than 90 days
- Resolved technical risks older than 30 days
- Outdated performance assessments
- Completed design reviews older than 45 days

### File Structure
```
memory/tech-lead/
├── MEMORY.md (this file)
├── adrs.md (architectural decision records)
├── design.md (system design notes)
├── risks.md (technical risk register)
└── history.md (recent guidance, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 30 entries, delete entries older than 30 days
- `adrs.md`: Never auto-delete, but summarize old entries
- `risks.md`: Remove resolved risks after 30 days
- Maximum file size: 600 lines per file

### Architectural Review Scope
Track decisions involving:
- New technology introductions
- Cross-cutting concerns
- Performance-critical paths
- Integration patterns
- Data model changes

### Output Format for Workflow
```json
{
  "architectural_concerns": [],
  "bugs_identified": [],
  "design_recommendations": [],
  "adrs_created": [],
  "risks_identified": [],
  "risks_mitigated": [],
  "engineer_guidance": []
}
```
