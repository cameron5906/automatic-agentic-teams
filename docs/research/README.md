# Research Documents

This directory contains research documents that capture investigation findings, technology evaluations, and exploratory analysis.

## Purpose

Research documents help the team:
- Understand complex areas of the codebase
- Evaluate technology choices
- Document findings from debugging sessions
- Capture exploratory analysis before implementation

## Table of Contents

| Document | Scope | Reviewer | Date |
|----------|-------|----------|------|
| _No research documents yet_ | | | |

## Filename Format

```
YYYY-MM-DD-short-description.md
```

Example: `2024-12-22-authentication-flow-analysis.md`

## Research Document Template

```markdown
# Title

**Date:** YYYY-MM-DD
**Reviewer:** Agent or person name
**Scope:** Brief description of what was investigated

---

## Executive Summary

A brief (2-3 paragraph) summary of the key findings and recommendations.

---

## Background

Context for why this research was conducted.

---

## Methodology

How the research was conducted.

---

## Findings

### Finding 1

Details...

### Finding 2

Details...

---

## Recommendations

1. Recommendation 1
2. Recommendation 2
3. Recommendation 3

---

## Files Reviewed

### Frontend

- `src/components/Example.tsx` - Description of relevance

### Backend Controllers

- `src/controllers/ExampleController.ts` - Description

### Backend Pipeline

- `src/pipeline/ExampleStage.ts` - Description

### Backend Core/Infrastructure

- `src/infrastructure/Example.ts` - Description

---

## Open Questions

- Question that needs further investigation
- Another open question

---

## References

- Link to relevant documentation
- Link to related issue or PR
```

## Creating a New Research Document

1. Create a new file: `YYYY-MM-DD-short-description.md`
2. Copy the template above
3. Fill in all relevant sections (remove sections that don't apply)
4. Update the Table of Contents in this README
5. Update `docs/README.md` Research table
