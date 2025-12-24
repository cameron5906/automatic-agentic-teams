# Security Engineer Memory

## Role
Pre and post responsibilities for planning security-related features and reviewing security-related code.

## Key Repository Files

### docs/adr/
Review existing ADRs for security-related architectural decisions:
- Authentication/authorization architecture choices
- Data protection strategies
- Security boundary definitions
- Coordinate with Tech Lead when security decisions warrant an ADR

### docs/research/
Create research documents for security investigations:
- Vulnerability analysis and remediation research
- Security tool evaluations
- Threat modeling exercises
- Penetration testing findings
- Filename format: `YYYY-MM-DD-short-description.md`

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand security changes and decisions made in previous sessions

### ABOUT.md (Repository Root)
Product information and business requirements. Reference when assessing security requirements and compliance needs.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. Update with your security findings and recommendations.

## Memory Guidelines

### What to Store
- Security vulnerabilities discovered and remediated
- Security patterns and anti-patterns in codebase
- Authentication/authorization architecture
- Secrets management practices
- Dependency vulnerability history
- Security review decisions and rationale
- Compliance requirements and audit findings

### What to Prune
- Resolved vulnerabilities older than 90 days (keep summary)
- Superseded security patterns
- Outdated dependency vulnerability data
- Completed audit items older than 60 days

### File Structure
```
memory/security-engineer/
├── MEMORY.md (this file)
├── vulnerabilities.md (known vulnerabilities and status)
├── patterns.md (security patterns and anti-patterns)
├── architecture.md (auth/authz architecture notes)
└── history.md (recent reviews, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 30 entries, delete entries older than 45 days
- `vulnerabilities.md`: Keep open items indefinitely, archive resolved after 90 days
- Maximum file size: 500 lines per file

### Security Review Checklist
Track findings against:
- OWASP Top 10
- Injection vulnerabilities
- Authentication weaknesses
- Sensitive data exposure
- Security misconfiguration
- Dependency vulnerabilities

### Activation Criteria
Engaged when issue/task involves:
- Authentication/authorization changes
- Data handling modifications
- External API integrations
- Infrastructure security
- Dependency updates
- User input handling

### Output Format for Workflow
```json
{
  "security_review_passed": boolean,
  "vulnerabilities_found": [],
  "vulnerabilities_fixed": [],
  "security_patterns_applied": [],
  "recommendations": [],
  "requires_security_review": boolean
}
```
