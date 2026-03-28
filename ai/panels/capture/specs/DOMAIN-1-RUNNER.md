# Domain 1: Runner

The engine that executes agent work. Reads a dispatched ticket, sets up a run folder, spawns a Kimi CLI orchestrator session, and manages the lifecycle.

**Prerequisites (all exist):**
- Agent folders with `prompt.md` at `ai/workspaces/background-agents/agents/{id}/`
- Ticket files at `ai/workspaces/issues/KIMI-NNNN.md`
- Dispatch watcher at `kimi-ide-server/lib/tickets/dispatch.js`
- Registry at `ai/workspaces/background-agents/registry.json`
- Ticket loader at `kimi-ide-server/lib/tickets/loader.js`

**Output:**
- `kimi-ide-server/lib/runner.js` — the runner module

---

## What the Runner Does

1. Receives a dispatch event (ticket + agent folder path)
2. Creates the run folder with seed files
3. Spawns a Kimi CLI orchestrator session
4. Feeds it the prompt + ticket context
5. Monitors the session (heartbeat)
6. On completion, updates ticket state and manifest

---

## Step-by-Step Implementation

### Step 1: Create Run Folder

When dispatch fires, the runner:

```
agents/{agent-id}/runs/{timestamp}/
├── ticket.md        ← copy from ai/workspaces/issues/KIMI-NNNN.md
├── prompt.md        ← copy from agents/{agent-id}/prompt.md
├── lessons.md       ← copy from agents/{agent-id}/LESSONS.md
├── manifest.json    ← new file, status: pending
├── run-index.json   ← new file, empty steps array
```

**Timestamp format:** `YYYY-MM-DDTHH-MM-SS` (filesystem-safe ISO)

**manifest.json initial state:**
```json
{
  "run_id": "{timestamp}",
  "agent_id": "{agent-id}",
  "bot_name": "{from prompt.md frontmatter}",
  "ticket_id": "{KIMI-NNNN}",
  "status": "pending",
  "created": "{ISO timestamp}",
  "started": null,
  "completed": null,
  "model": "{from prompt.md frontmatter}",
  "outcome": null,
  "error": null
}
```

**run-index.json initial state:**
```json
{
  "version": "1.0",
  "steps": []
}
```

### Step 2: Parse prompt.md Frontmatter

Read `prompt.md`, split YAML frontmatter from markdown body.

Extract from frontmatter:
- `bot_name` — for logging
- `model` — for Kimi CLI flags (thinking mode, context size)
- `limits` — timeout, max retries, confidence threshold
- `scope` — read/write restrictions (inform the orchestrator, enforced by trust)

The markdown body (after the `---` closer) is the orchestrator's instruction set.

### Step 3: Build Orchestrator Context

The orchestrator receives three pieces of context:

**System context (first message or system prompt):**
```
{contents of ai/workspaces/background-agents/AGENTS.md}

---

{contents of prompt.md body — the orchestrator instructions}

---

## Lessons from Previous Runs

{contents of LESSONS.md}
```

**User message (the work to do):**
```
## Ticket: {ticket ID}

{contents of ticket.md — frontmatter + body}

## Run Folder

Your run folder is at: {absolute path to run folder}

You must write evidence cards to this folder as you work. See the prompt
instructions for the checkpoint discipline. Each step produces a numbered
markdown file BEFORE you proceed to the next step.

## Files in Your Run Folder

- ticket.md (frozen ticket)
- prompt.md (frozen prompt)
- lessons.md (frozen lessons)
- manifest.json (update status as you progress)
- run-index.json (update after each step)
```

### Step 4: Spawn Kimi CLI

```javascript
const args = ['--wire', '--yolo'];

// Work directory is the project root (agents read broadly)
args.push('--work-dir', projectRoot);

const proc = spawn(kimiPath, args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, TERM: 'xterm-256color' }
});
```

**Note:** Do NOT use `--session` for agent runs. Each run is a fresh session. The run folder is the persistence mechanism, not Kimi's session system.

After spawning:
1. Send initialize message (JSON-RPC handshake)
2. Wait for initialization response
3. Send the system context + user message as the first prompt
4. Begin monitoring

### Step 5: Monitor the Session

**Wire event handling:**
- Listen for `TurnBegin`, `ContentPart`, `ToolCall`, `ToolResult`, `TurnEnd` events
- On `TurnEnd`: check if the orchestrator has indicated completion (ticket closed) or needs another turn
- Log all events to the run folder (optional: `wire.log`)

**Heartbeat (5-minute interval):**
- Check: has a new file been written to the run folder since last check?
- Check: has there been a `ToolCall` event since last check?
- If neither: inject a continue prompt via the wire:
  ```
  You appear stalled. Your run folder is at {path}.
  Check run-index.json for your current step and proceed.
  If you are waiting for input, close the ticket with your current findings.
  ```
- Track consecutive stalls. After 3 with no progress:
  - Update manifest: `status: stopped`, `error: "Stalled after 3 heartbeats"`
  - Kill the wire process
  - Leave ticket open with state comment

**Timeout:**
- Read `limits.timeout_minutes` from prompt.md frontmatter
- If the total run time exceeds this, kill the wire process
- Update manifest: `status: stopped`, `error: "Timeout after {N} minutes"`
- Leave ticket open

### Step 6: Handle Completion

When the orchestrator closes the ticket (detected by ticket file state change or explicit signal):

1. Update manifest: `status: completed`, `completed: {timestamp}`, `outcome: success`
2. Update registry.json: agent status → `idle`
3. Update `ai/workspaces/background-agents/index.json`: agent `last_run` timestamp
4. Update `ai/workspaces/issues/index.json`: ticket state → closed

### Step 7: Handle Errors

If the wire process exits unexpectedly:

1. Check manifest — what was the last known state?
2. If `status: pending` (never started): `error: "Wire process failed to start"`
3. If `status: in_progress`: `error: "Wire process exited unexpectedly (code {N})"`
4. Read `run-index.json` — how far did it get?
5. Write a `{NN}-error.md` evidence card documenting the failure
6. Leave ticket open for retry or manual review
7. Update registry: agent status → `idle`

---

## Module Interface

```javascript
// kimi-ide-server/lib/runner.js

/**
 * Execute an agent run for a dispatched ticket.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {string} agentFolder - Relative path to agent folder (e.g., "agents/wiki-updater")
 * @param {object} ticket - Parsed ticket { frontmatter, body, filename }
 * @returns {Promise<{ runId: string, runPath: string, status: string }>}
 */
async function executeRun(projectRoot, agentFolder, ticket) { }

/**
 * Check active runs for stalls (called by heartbeat interval).
 *
 * @param {string} projectRoot
 */
async function checkHeartbeats(projectRoot) { }

module.exports = { executeRun, checkHeartbeats };
```

---

## Integration Points

**Dispatch watcher calls the runner:**
Currently `dispatch.js` just console.logs. Replace with:
```javascript
if (shouldDispatch(ticket)) {
  const agent = registry.agents[ticket.frontmatter.assignee];
  runner.executeRun(projectRoot, agent.folder, ticket);
}
```

**Server startup starts the heartbeat:**
```javascript
// In server.js, after server.listen
setInterval(() => runner.checkHeartbeats(projectRoot), 5 * 60 * 1000);
```

---

## Test Plan

1. Create a test ticket: `node ai/workspaces/issues/scripts/create-ticket.js --title "Test runner" --assignee kimi-wiki --body "This is a test. Read ai/workspaces/wiki/secrets/PAGE.md and summarize it."`
2. Verify run folder created at `agents/wiki-updater/runs/{timestamp}/`
3. Verify seed files present: ticket.md, prompt.md, lessons.md, manifest.json, run-index.json
4. Verify Kimi CLI spawns and receives the prompt
5. Verify evidence cards appear as the orchestrator works
6. Verify manifest updates to `completed` when done
7. Verify ticket moved to `done/`

---

## Key Files

| File | Action |
|------|--------|
| `kimi-ide-server/lib/runner.js` | **Create** — the runner module |
| `kimi-ide-server/lib/tickets/dispatch.js` | **Modify** — call runner instead of console.log |
| `kimi-ide-server/server.js` | **Modify** — start heartbeat interval on boot |
| `ai/workspaces/background-agents/registry.json` | **Read** — agent folder lookup |
| `ai/workspaces/background-agents/agents/*/prompt.md` | **Read** — frontmatter + instructions |
| `ai/workspaces/issues/index.json` | **Modify** — ticket state updates |
| `ai/workspaces/background-agents/index.json` | **Modify** — agent status + last_run |

---

## What This Does NOT Build

- Evidence card format enforcement (Domain 2)
- LESSONS.md token counting and review triggers (Domain 4)
- Ticket blocking logic (Domain 5)
- File watcher for source changes (Domain 3)
- UI for viewing run history
