# System Overview

> The wiki is the brain. The agents are the hands. The attestations are the receipts.

---

## What This System Is

An AI-native development environment where agents maintain a living knowledge graph, execute work through ticketed workflows, and validate every mutation through structured evidence before acting.

The system is designed so that when a user downloads the app and opens a project, agents in all workspaces work out of the box — self-referencing the system wiki for how to behave, the project wiki for domain knowledge, and the workspace machinery for execution.

---

## Three Layers

### 1. Knowledge (Wikis)

Two wiki collections, each a set of linked topic pages:

**System Wiki** (`ai/wiki/system/`) — Ships with the app. Frozen between releases. Describes *how the system works*: validation philosophy, workflow design patterns, agent conventions. Every agent reads it. No agent writes it. Updated only by app releases.

**Project Wiki** (`ai/wiki/project/`) — Per-project, living, agent-maintained. Describes *how this project works*: architecture, secrets, integrations, decisions. Agents read and write it through ticketed workflows. Syncs to GitLab for browser-readable access. [GitLab sync currently implemented via `scripts/sync-wiki.sh`]

Both wikis follow the same structure: topic folders containing `PAGE.md` (the published page) and `LOG.md` (the change trail). An `index.json` maps the topic graph — edges between pages — so agents can traverse on demand without preloading everything.

### 2. Behavior (Evidence-Gated Execution)

Every autonomous mutation — code edits, wiki updates, ticket resolutions — follows the [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) pattern:

1. **Produce** an attestation: gather evidence, reason about the change
2. **Validate** the attestation: independently verify the evidence supports the change
3. **Execute** from the attestation: make exactly the changes described, record outcome

This is not optional for autonomous agents. It is the default execution model. See [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) for the research foundations and [Workflow Design Guide](../workflow-design/PAGE.md) for how to implement it.

**Exemptions:** Specs, collaborative riffing, and wiki page construction done interactively with a human in the loop do not require EGE. The boundary is: if a human is actively participating, EGE is optional. If an agent is acting autonomously, EGE is mandatory.

### 3. Structure (Workspaces + Agents)

The execution machinery lives in `ai/workspaces/`. Each workspace is a domain:

| Workspace | Purpose |
|-----------|---------|
| `background-agents/` | Agent definitions, workflows, runners |
| `issues/` | Ticketing — dispatch, sync, lifecycle |
| `wiki/` | Wiki agent — maintains project wiki content |
| `coding-agent/` | Code workspace — interactive development |
| `capture/` | Specs, designs, research capture |
| `skills/` | Skill definitions and maintenance |
| `terminal/` | Terminal workspace |

Each workspace has its own agent defined by standard files. See [Agent Folder Structure](../agent-folder-structure/PAGE.md) for the conventions.

---

## How Work Flows

```
Trigger (commit, cron, user, file change)
  → Ticket created in ai/workspaces/issues/
  → Assigned to bot name (e.g., kimi-wiki)
  → Dispatch watcher fires
  → Runner spawns CLI session with agent's config
  → CLI primary agent becomes the orchestrator
  → Orchestrator delegates steps to sub-agents
  → Each step produces an attestation [not yet implemented — currently evidence cards]
  → Attestation is validated before execution proceeds
  → Run folder captures full audit trail
  → Ticket closed, STATE.md updated
```

### The Orchestrator Pattern

When a ticket dispatches, the CLI's primary agent is the orchestrator. It is invisible — not a chat partner, but a coordinator. It:

- Reads numbered workflow prompts in order
- Delegates each step to a sub-agent
- Evaluates sub-agent output before proceeding
- Accumulates context across steps (sub-agents are stateless)
- Retries or stops based on confidence thresholds
- Never commits — reports results

### Cross-Workspace Awareness

`ai/STATE.md` is the cross-workspace breadcrumb trail. Every workspace agent reads it at session start and writes to it after completing work. It captures the narrative: what was the human doing, what decisions were made, what's unfinished.

---

## The Knowledge Graph Vision

Over time, the wikis become a knowledge graph:

- **Topics** are nodes
- **Edges** (in `index.json`) are relationships between topics
- **Attestations** are the evidence trail for how knowledge evolved
- **LOG.md** per topic captures the change history
- **Run folders** capture the full reasoning chain for each change

Any agent entering the system can orient by reading `index.json` (lightweight, ~20 tokens per topic), then traversing to the specific pages it needs. The system wiki tells it *how to behave*. The project wiki tells it *what's true about this project*.

---

## Cross-CLI Portability

[Not yet implemented]

The system is designed to work across multiple CLI harnesses:

- **Kimi CLI** — current primary, has sub-agents and wire protocol
- **Claude Code** — hooks into tool calls for validation
- **OpenCode** — [planned integration]

The [Validation Subagent](../validation-subagent/PAGE.md) is designed to be portable across these harnesses. If the folder structure and sub-agent formatting aligns, programmatic tweaks adapt the same validation logic to each CLI.

---

## What Agents Should Read First

If you are an agent entering this system for the first time:

1. **This page** — you're here
2. **[Evidence-Gated Execution](../evidence-gated-execution/PAGE.md)** — the validation philosophy
3. **[Agent Folder Structure](../agent-folder-structure/PAGE.md)** — where things go and why
4. **[Workflow Design Guide](../workflow-design/PAGE.md)** — how to build compliant workflows
5. **`ai/STATE.md`** — what happened recently

If you are an agent *building another agent*, also read:
- **[Validation Subagent](../validation-subagent/PAGE.md)** — how validation is enforced
- The target workspace's existing agent files for patterns to follow
