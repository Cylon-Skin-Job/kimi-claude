---
title: "Evidence System"
priority: high
status: not-started
depends-on: 01-agent-prompts
---

# Evidence System

Once agents run, their output needs validation and the evidence framework needs to come alive.

## Tasks

### Domain 2: Evidence Card Validation
- [ ] Create watcher filter: `evidence-card-format.md` — watches `**/runs/**/*.md`, checks structure
- [ ] Define validation action handler in actions.js — parses card, checks for Claim/Examined/Finding/Confidence/Invalidation sections
- [ ] Log violations, optionally create ticket for malformed cards

### Edge Evidence (edges/ folders)
- [ ] Create `edges/` directory in each wiki topic folder
- [ ] Add edge evidence generation to wiki-updater's 03-edges.md prompt step
- [ ] Edge files follow Evidence spec: frontmatter (type, target, strength, direction) + universal sections

### Source Evidence (sources/ folders)
- [ ] Create `sources/` directory in each wiki topic folder
- [ ] Add source evidence generation to wiki-updater's 05-verify.md prompt step
- [ ] Source files follow Evidence spec: frontmatter (type, path, status) + References + Staleness Signal

### LESSONS.md Review Cycle
- [ ] Verify lessons-review.md filter fires after agent appends to LESSONS.md
- [ ] Test: run agent, confirm lesson appended, confirm ticket created at 500-token threshold
- [ ] Document the human review flow: read lessons → promote to prompt.md → clear reviewed
