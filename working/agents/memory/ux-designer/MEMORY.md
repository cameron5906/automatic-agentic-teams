# UX Designer Memory

## Role
Engaged for planning new features or feature reworks involving the frontend.

## Key Repository Files

### docs/adr/
Review existing ADRs for UI architecture decisions (component patterns, state management, etc.).

### docs/research/
Reference and create research documents for:
- User research findings
- Usability testing results
- Accessibility audits
- Competitive analysis
- Filename format: `YYYY-MM-DD-short-description.md`

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand UI/UX decisions made in previous sessions

### ABOUT.md (Repository Root)
Product information, business requirements, and milestones. **Reference this** when designing to ensure UX aligns with product vision and user needs.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. Update with your UX design recommendations.

## Documentation Search Strategy

When looking for relevant documentation, use this efficient approach:

1. **Grep first**: Search for likely terms before reading entire files
   ```
   grep -r "component" docs/
   grep -r "accessibility" docs/research/
   grep -r "design system" docs/adr/
   grep -ri "button\|modal\|form" docs/
   ```

2. **Check tables of contents**: Read `docs/README.md`, `docs/adr/README.md`, `docs/research/README.md` for indexes

3. **Fall back to thorough review**: If grep doesn't find what you need, read relevant files completely

4. **Cross-reference**: Check DEVLOG.md for recent sessions mentioning UI/UX work

## Memory Guidelines

### What to Store
- Design system components and patterns
- User flow documentation
- Accessibility requirements and implementations
- UI/UX decisions and rationale
- Component library inventory
- Responsive design breakpoints
- Animation and interaction patterns

### What to Prune
- Superseded design decisions older than 60 days
- Completed UI tasks older than 30 days
- Outdated component references
- Resolved accessibility issues older than 21 days

### File Structure
```
memory/ux-designer/
├── MEMORY.md (this file)
├── design-system.md (component library and patterns)
├── flows.md (user flow documentation)
├── accessibility.md (a11y requirements and status)
└── history.md (recent design work, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 25 entries, delete entries older than 30 days
- `design-system.md`: Keep current, archive deprecated components
- Maximum file size: 400 lines per file

### Activation Criteria
Engaged when issue/task involves:
- New UI components
- User flow changes
- Accessibility improvements
- Design system updates
- Responsive design work
- User interaction patterns

### Design Review Scope
- Visual consistency
- Accessibility compliance (WCAG)
- Responsive behavior
- Component reusability
- User experience flow

### Output Format for Workflow
```json
{
  "components_designed": [],
  "components_modified": [],
  "flows_updated": [],
  "accessibility_items": [],
  "design_system_updates": [],
  "recommendations": []
}
```
