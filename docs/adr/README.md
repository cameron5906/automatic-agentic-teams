# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) that document significant architectural decisions made in this project.

## What is an ADR?

An ADR captures a single architectural decision along with its context and consequences. ADRs help future team members understand why certain decisions were made.

## Table of Contents

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| _No ADRs yet_ | | | |

## Statuses

- **Proposed**: Under discussion
- **Accepted**: Decision has been made and is in effect
- **Deprecated**: No longer applies but kept for historical context
- **Superseded**: Replaced by a newer ADR

## Filename Format

```
YYYY-MM-DD-short-description.md
```

Example: `2024-12-22-publication-prep-stage-design.md`

## ADR Template

```markdown
# ADR-XXX: Title

**Status:** Proposed | Accepted | Deprecated | Superseded

**Date:** YYYY-MM-DD

## Context

Describe the context and problem statement. What is the issue that we're seeing that is motivating this decision?

## Decision

Describe the decision that was made. Use active voice: "We will..."

## Consequences

### Positive

- Benefit 1
- Benefit 2

### Negative

- Drawback 1
- Drawback 2

### Neutral

- Observation 1

## Implementation Checklist

### Domain Layer

- [ ] Task 1
- [ ] Task 2

### Infrastructure Layer

- [ ] Task 1

### Jobs Layer

- [ ] Task 1

### Tests

- [ ] Unit tests
- [ ] Integration tests

### Documentation

- [ ] Update README
- [ ] Update API docs

## Alternatives Considered

### 1. Alternative Name

Description of the alternative and why it was not chosen.

### 2. Another Alternative

Description and rationale for rejection.

## Invariants

1. Invariant that must always hold
2. Another invariant

## Related Decisions

- ADR-XXX: Related decision title

## References

- Link to relevant documentation
- Link to related issue or PR
```

## Creating a New ADR

1. Determine the next ADR number by checking existing ADRs
2. Create a new file: `YYYY-MM-DD-short-description.md`
3. Copy the template above
4. Fill in all sections
5. Update the Table of Contents in this README
6. Update `docs/README.md` ADR table
