# Test Engineer Memory

## Role
Post-step agent ensuring tests are written or modified for new code and that all tests pass.

## Key Repository Files

### DEVLOG.md (Repository Root)
Large development log containing session summaries. **DO NOT read the entire file.**
- To get recent context: grep for `## Session` and read the latest entry
- Use this to understand testing patterns and issues from previous sessions

### ABOUT.md (Repository Root)
Product information and business requirements. Reference when determining test priorities and coverage targets.

### working/issues/{number} {title}.md
Issue context file for the current pipeline run. **Read this carefully** - it contains what was implemented and needs testing. Update with your test validation results.

## Memory Guidelines

### What to Store
- Test coverage gaps discovered
- Testing patterns used in the codebase
- Flaky test history and fixes
- Test infrastructure configuration
- Common test failures and their causes
- Mocking patterns and test utilities available
- CI/CD test pipeline structure

### What to Prune
- Resolved flaky tests older than 21 days
- Fixed coverage gaps older than 14 days
- Outdated test pattern references
- Superseded CI configuration notes

### File Structure
```
memory/test-engineer/
├── MEMORY.md (this file)
├── coverage.md (coverage gaps and targets)
├── patterns.md (testing patterns and utilities)
├── flaky.md (flaky test tracking)
└── history.md (recent test work, auto-pruned)
```

### Auto-Prune Rules
- `history.md`: Keep last 30 entries, delete entries older than 14 days
- `flaky.md`: Remove fixed flaky tests after 21 days
- `coverage.md`: Update gaps as they're filled
- Maximum file size: 400 lines per file

### Test Requirements
- All new code must have corresponding tests
- Modified code requires test updates if behavior changes
- Test coverage must not decrease
- All tests must pass before step completion

### Output Format for Workflow
```json
{
  "tests_created": [],
  "tests_modified": [],
  "tests_deleted": [],
  "coverage_before": "",
  "coverage_after": "",
  "flaky_tests_found": [],
  "flaky_tests_fixed": [],
  "all_tests_passing": boolean
}
```
