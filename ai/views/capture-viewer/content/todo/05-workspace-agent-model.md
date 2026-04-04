---
title: "Universal Workspace Agent Model"
priority: medium
status: not-started
---

# Universal Workspace Agent Model

Every workspace gets the 5-file pattern. The server enforces scope and injects workflow.

## Tasks

### Per-Workspace Files
- [ ] Write PROMPT.md for each workspace (identity + scope)
- [ ] Write TOOLS.md for each workspace (allowed/denied tool calls)
- [ ] Write WORKFLOW.md for each workspace (process gates, guardrails)
- [ ] Write api.json for each workspace (model preferences, context size)
- [ ] Verify workspace.json exists and is current for all workspaces

### Server Enforcement
- [ ] Tool filtering: server reads TOOLS.md, blocks denied tool calls before passing to wire
- [ ] WORKFLOW.md injection: server prepends workflow rules to agent context on write operations
- [ ] api.json hot-swap: server creates temporary model config overlay per workspace session

### Additional Agents
- [ ] Write prompts for kimi-code (bug-fixer)
- [ ] Write prompts for kimi-review (code-reviewer)
- [ ] Write prompts for kimi-edge (edge-checker)
- [ ] Write prompts for kimi-skills (skills-sync)
- [ ] Add each to registry.json
