# Run Folder Specification

How agent runs are structured, checkpointed, and audited. The run folder is the physical evidence trail — every decision is documented before the next step begins.

---

## Lifecycle

```
Dispatch fires (ticket assigned to bot)
  │
  ├─ Runner creates run folder
  ├─ Runner freezes ticket.md + prompt.md + LESSONS.md into folder
  ├─ Runner writes manifest.json (status: pending)
  ├─ Runner writes run-index.json (empty steps list)
  ├─ Runner spawns orchestrator with run folder path
  │
  ├─ Orchestrator Step 0: Validate
  │   Verify run folder exists, all seed files present
  │   Update manifest status: in_progress
  │   Update ticket state: claimed
  │   Write 00-validate.md evidence card
  │
  ├─ Orchestrator Step N: Execute
  │   Write NN-{step-name}.md BEFORE delegating to sub-agent
  │   Sub-agent does work, returns result
  │   Orchestrator evaluates result
  │   Updates run-index.json with step outcome
  │   → Accept: proceed to N+1
  │   → Reject: write NN-{step-name}.retry-{N}.md, re-delegate
  │   → Stop: update manifest status: stopped, leave ticket open
  │
  ├─ Orchestrator Final Step: Close
  │   Write final evidence card
  │   Update manifest status: completed
  │   Close ticket
  │
  ├─ Orchestrator Final: Reflect
  │   Did anything unexpected happen? Was a mistake caught?
  │   If yes, append to agents/{agent-id}/LESSONS.md (the live file, not the frozen copy)
  │
  └─ Run folder is now a complete audit trail
```

---

## Folder Structure

```
agents/{agent-id}/runs/{timestamp}/
├── ticket.md              ← frozen copy of the triggering ticket
├── prompt.md              ← frozen copy of the agent's prompt at execution time
├── lessons.md             ← frozen copy of LESSONS.md at execution time
├── manifest.json          ← run metadata (status, timing, model, outcome)
├── run-index.json         ← step-by-step progress tracker
├── 00-validate.md         ← Step 0: checkpoint validation evidence card
├── 01-gather.md           ← Step 1: evidence card
├── 01-gather.retry-1.md   ← Step 1: first retry (if rejected)
├── 02-propose.md          ← Step 2: evidence card
├── 03-execute.md          ← Step 3: evidence card
└── 04-verify.md           ← Step 4: evidence card
```

---

## Seed Files (Created by Runner)

The runner creates these before the orchestrator starts. They are the preconditions.

### ticket.md

Exact copy of the ticket that triggered the run. Frozen at dispatch time so the orchestrator has a stable reference even if the original ticket is modified during execution.

### prompt.md

Exact copy of `agents/{agent-id}/prompt.md` at dispatch time. If the prompt is edited while an agent is running, the running agent uses the frozen version.

### manifest.json

```json
{
  "run_id": "2026-03-22T09-00-00",
  "agent_id": "wiki-updater",
  "bot_name": "kimi-wiki",
  "ticket_id": "KIMI-0007",
  "status": "pending",
  "created": "2026-03-22T09:00:00Z",
  "started": null,
  "completed": null,
  "model": "claude-sonnet-4-6",
  "outcome": null,
  "error": null
}
```

**Status values:** `pending` → `in_progress` → `completed` | `stopped` | `error`

**Outcome values (when completed):** `success` | `partial` | `rejected`

### run-index.json

The step-by-step tracker. The orchestrator reads this to know where it is, and writes to it after each step. This is how retries and context loading work — the orchestrator reads the index, sees what's been done, and knows what to do next.

```json
{
  "version": "1.0",
  "steps": []
}
```

After execution, a populated index looks like:

```json
{
  "version": "1.0",
  "steps": [
    {
      "number": 0,
      "name": "validate",
      "file": "00-validate.md",
      "status": "completed",
      "attempt": 0,
      "started": "2026-03-22T09:00:12Z",
      "completed": "2026-03-22T09:00:14Z"
    },
    {
      "number": 1,
      "name": "gather",
      "file": "01-gather.md",
      "status": "completed",
      "attempt": 2,
      "retries": [
        {
          "attempt": 1,
          "file": "01-gather.retry-1.md",
          "rejection": "Did not check git log as instructed"
        }
      ],
      "started": "2026-03-22T09:00:14Z",
      "completed": "2026-03-22T09:01:45Z"
    },
    {
      "number": 2,
      "name": "propose",
      "file": "02-propose.md",
      "status": "completed",
      "attempt": 0,
      "started": "2026-03-22T09:01:45Z",
      "completed": "2026-03-22T09:02:30Z"
    }
  ]
}
```

---

## Evidence Cards

Every step produces a markdown file. This file is the proof that the step happened, what was decided, and why. The orchestrator writes the card BEFORE delegating to the next step.

### Naming Convention

```
{NN}-{step-name}.md              ← accepted attempt
{NN}-{step-name}.retry-{N}.md   ← rejected attempt (N = 1, 2, 3...)
```

- `NN` = zero-padded step number (00, 01, 02...)
- `step-name` = kebab-case name matching the step heading in prompt.md
- Retry files preserve the rejected output — they are never deleted
- The file without a retry suffix is always the accepted attempt

### Card Structure

Every evidence card follows this format:

```markdown
# Step {N}: {Name}

## Decision
{Proceed | Retry | Stop} — one-line summary of what was decided.

## Evidence
- Read: {file path} ({what was found})
- Read: {file path} ({what was found})
- Ran: {command} ({summary of output})
- Checked: {what was verified}

## Finding
{What the evidence shows. Plain language, specific details.}

## Confidence
{High | Medium | Low} — {why this confidence level, citing evidence above}
```

### Retry Cards

When the orchestrator rejects a step, the retry card includes the rejection reason before the new attempt:

```markdown
# Step {N}: {Name} (retry {M})

## Rejection of attempt {M-1}
{Why the previous attempt was rejected. What was missing or wrong.}

## Decision
...

## Evidence
...
```

---

## Step 0: Validate

Every run starts with Step 0. The orchestrator's first action is to verify the run folder was set up correctly. This is the agent's own preflight check.

### What it checks

1. Run folder exists at the expected path
2. `ticket.md` is present and readable
3. `prompt.md` is present and readable
4. `lessons.md` is present and readable
5. `manifest.json` is present, status is `pending`
6. `run-index.json` is present, steps array is empty

### What it does

1. Reads all seed files to confirm they're valid
2. Updates `manifest.json` status → `in_progress`, sets `started` timestamp
3. Updates the ticket state → `claimed` (so dispatch doesn't re-fire)
4. Writes `00-validate.md` with evidence of what was checked
5. Adds step 0 to `run-index.json`

### If validation fails

The orchestrator writes the validation failure to `00-validate.md` and updates manifest status → `error`. The ticket stays open for manual review.

---

## How the Orchestrator Uses run-index.json

The orchestrator reads `run-index.json` at the start of each step to understand context:

1. **Know where it is:** "Steps 0-2 are completed, I'm on step 3"
2. **Load prior context:** Read the evidence cards for completed steps to build up context for sub-agent delegation
3. **Handle resumption:** If the orchestrator is restarted mid-run (crash recovery), it reads the index, finds the last completed step, and resumes from there
4. **Track retries:** Before delegating, check if this step has previous attempts. If so, include the rejection reasons in the sub-agent's instructions

### Context Building Pattern

When delegating step N to a sub-agent, the orchestrator:

1. Reads `run-index.json` to get the list of completed steps
2. For each completed step, reads the evidence card's **Finding** section
3. Assembles: ticket body + findings from steps 0 through N-1 + step N instructions
4. Sends to sub-agent

This keeps sub-agent context minimal — they get findings, not full evidence cards. The orchestrator holds the full picture.

---

## Heartbeat

The runner monitors active runs. If 5 minutes pass with no new file written to the run folder and no tool call activity on the wire:

1. Check `manifest.json` — is status still `in_progress`?
2. Check `run-index.json` — what's the last completed step?
3. Inject a continue prompt: "You appear stalled on step {N}. Your run folder is at {path}. Check run-index.json and proceed."

If 3 consecutive heartbeats fire with no progress:
1. Update manifest status → `stopped`
2. Write a `{NN}-stalled.md` evidence card documenting the stall
3. Leave ticket open with a comment: "Agent stalled after step {N-1}"

---

## Recovery

If the orchestrator crashes or the wire process dies mid-run:

1. Manifest shows `status: in_progress` — this is a stale run
2. The heartbeat or next dispatch cycle detects it
3. Runner can re-spawn the orchestrator with the same run folder
4. Orchestrator reads `run-index.json`, sees steps 0-2 completed, resumes at step 3
5. No work is duplicated — evidence cards prove what already happened

---

## LESSONS.md — Agent Institutional Memory

Each agent has a `LESSONS.md` file in its folder (not in the run folder). This is the agent's living notebook — observations, gotchas, and patterns discovered across runs.

### How it works

1. **At run start:** The runner freezes a copy of `LESSONS.md` into the run folder. The orchestrator reads this frozen copy as part of its context, alongside `prompt.md` and `ticket.md`. Past lessons inform current decisions.

2. **During the run:** If the orchestrator catches a mistake, encounters something unexpected, or discovers a pattern not covered in the prompt, it notes it internally.

3. **At run end:** After the final step, the orchestrator appends any new lessons to the **live** `LESSONS.md` file (the one in the agent folder, not the frozen copy). This ensures the next run benefits from what this run learned.

### Entry format

```markdown
### {date} — {short title}
{What happened, what was learned, what to watch for next time.}
```

### Example entries

```markdown
### 2026-03-22 — index.json edges are order-sensitive
When rebuilding edges, the order in edges_out matters for the wiki UI.
Always preserve existing order and append new edges at the end.

### 2026-03-23 — secrets.js has two export styles
The file uses both module.exports and named exports. When checking
function names, grep for both patterns or you'll miss half of them.
```

### Promotion to prompt.md

Lessons accumulate over time. When there's enough new material to justify a review, a ticket is created for the human operator. The human reads the lessons, promotes the valuable ones into `prompt.md` as permanent instructions, and removes them from `LESSONS.md`.

### Review trigger — token threshold

Reviews are event-driven, not time-driven. No cron jobs, no calendar reminders.

After each run appends to `LESSONS.md`, the unreviewed content is measured by estimated token count (word count × 1.3). When the unreviewed portion exceeds **500 tokens**, a ticket is created:

```
Title: "Review lessons for {agent-name}"
Assignee: {human username}
Body: "LESSONS.md has ~{N} tokens of unreviewed content across {M} entries
      since last review. Read, evaluate, and promote useful lessons into
      prompt.md. Then clear the reviewed entries from LESSONS.md."
```

**Why tokens, not entry count:** A one-line gotcha isn't worth interrupting for. A detailed paragraph about a subtle failure mode is. Token count tracks cognitive load — how much is there to actually read and think about.

**No duplicates:** If an open review ticket already exists for this agent, don't create another. The existing ticket's body can be updated with the new count.

**No nagging:** If the human is away for three weeks, the ticket sits in the Inbox. No escalation, no reminders. When they open the IDE and look at the ticket board, it's there.

**Tracking the watermark:** The agent's entry in `background-agents/index.json` tracks:

```json
"wiki-updater": {
  ...
  "lessons_tokens_total": 850,
  "lessons_tokens_reviewed": 200
}
```

After a human review, `lessons_tokens_reviewed` is set to match `lessons_tokens_total`. The threshold check is: `total - reviewed >= 500`.

---

## What This Does NOT Do

- **No streaming to the UI during runs.** The run folder is the record. Live streaming is a future enhancement.
- **No automatic commits.** The agent writes files but never commits. The human operator reviews and commits.
- **No parallel steps.** Steps execute sequentially. Parallelism would require a different index structure.
- **No nested runs.** If a step creates a child ticket, that's a new run in a different agent's folder. The parent manifest records the child ticket ID, but doesn't track its progress.
