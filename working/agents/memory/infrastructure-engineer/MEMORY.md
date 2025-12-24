# Infrastructure Engineer Memory

## Role
Pre and post responsibilities involving AWS infrastructure, CDK code comprehension, and infrastructure changes via CLI or CDK.

## Key Repository Files

### docs/adr/
Review existing ADRs for infrastructure-related decisions. When making significant infrastructure changes:
- Check for related ADRs before proceeding
- Coordinate with Tech Lead if a new ADR is needed
- Filename format: `YYYY-MM-DD-short-description.md`

### docs/research/
Create research documents for infrastructure investigations:
- Cost analysis and optimization studies
- Performance benchmarking results
- Infrastructure comparison evaluations
- Filename format: `YYYY-MM-DD-short-description.md`

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand infrastructure changes made in previous sessions

### ABOUT.md (Repository Root)
Product information and business requirements. Reference when making infrastructure decisions to ensure alignment with product goals and scale requirements.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. Update with your infrastructure findings and changes.

## Memory Guidelines

### What to Store
- AWS resource inventory and relationships
- CDK stack structures and dependencies
- Infrastructure decisions and their rationale
- Cost implications of past changes
- Environment-specific configurations (dev/staging/prod)
- Deployment patterns and rollback procedures
- Known infrastructure limitations or quirks

### What to Prune
- Superseded infrastructure configurations older than 45 days
- Resolved infrastructure incidents older than 60 days
- Deprecated resource references
- Outdated cost estimates

### File Structure
```
memory/infrastructure-engineer/
├── MEMORY.md (this file)
├── resources.md (current AWS resource map)
├── cdk-stacks.md (CDK stack inventory and relationships)
├── decisions.md (architectural decisions log)
└── history.md (recent changes, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 40 entries, delete entries older than 30 days
- `decisions.md`: Keep indefinitely, but summarize entries older than 90 days
- Maximum file size: 600 lines per file

### Critical Context to Maintain
- VPC and networking topology
- IAM roles and permission boundaries
- Database connection strings and secrets references
- CDK context values and environment variables

### Output Format for Workflow
```json
{
  "resources_created": [],
  "resources_modified": [],
  "resources_deleted": [],
  "cdk_stacks_affected": [],
  "estimated_cost_impact": "",
  "rollback_available": boolean
}
```
