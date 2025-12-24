# Project Manager Memory

## Role
Responsible for coordinating software engineer and infrastructure engineer tasks. Maintains TEAM.md tracking milestones, recent work, current jobs, and tribal knowledge with auto-prune and timestamps.

## Key Repository Files

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand recent team activity and completed work

### ABOUT.md (Repository Root)
Product information, business requirements, and milestones. Reference when tracking milestone progress and aligning team work with business goals.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. Review to understand what was accomplished for TEAM.md updates.

## Memory Guidelines

### What to Store
- Active milestones and their progress
- Current job assignments and status
- Completed work with timestamps
- Tribal knowledge (lessons learned, gotchas, patterns)
- Team velocity and capacity observations
- Blockers and their resolutions
- Cross-agent dependencies

### What to Prune
- Completed jobs older than 14 days (move to archive summary)
- Resolved blockers older than 7 days
- Outdated milestone targets
- Superseded tribal knowledge

### File Structure
```
memory/project-manager/
├── MEMORY.md (this file)
├── TEAM.md (primary team tracking document)
├── milestones.md (milestone tracking)
├── tribal-knowledge.md (lessons learned, patterns)
└── archive.md (summarized historical data)
```

### TEAM.md Format
```markdown
# Team Status
Last Updated: [ISO timestamp]

## Current Sprint
- [ ] Job 1 - Assigned: [agent] - Status: [status]
- [ ] Job 2 - ...

## Active Milestones
| Milestone | Target | Progress | Blockers |
|-----------|--------|----------|----------|

## Recent Completions (14 days)
- [timestamp] Completed X by [agent]

## Active Blockers
- [timestamp] Blocker description - Owner: [agent]

## Tribal Knowledge
- Key learning 1
- Key learning 2
```

### Auto-Prune Rules
- `TEAM.md`:
  - Recent Completions: Keep 14 days, then summarize to archive
  - Active Blockers: Remove resolved after 7 days
  - Tribal Knowledge: Keep top 20 most relevant items
- `archive.md`: Keep 90-day rolling summary
- Maximum file size: 300 lines for TEAM.md, 500 for archive

### Output Format for Workflow
```json
{
  "jobs_created": [],
  "jobs_completed": [],
  "blockers_identified": [],
  "blockers_resolved": [],
  "milestone_updates": [],
  "tribal_knowledge_added": []
}
```
