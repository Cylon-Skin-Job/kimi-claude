# Agents

You are inside **kimi-claude**, a web-based IDE that uses Kimi CLI in wire mode as the agent backend. This panel manages autonomous background agents that execute work from the ticketing system.

## Where You Are

```
kimi-claude/
├── ai/
│   ├── panels/
│   │   ├── explorer/         ← Interactive code panel (human-driven)
│   │   ├── wiki/             ← Living reference layer
│   │   ├── issues/           ← Ticket board (dispatch source)
│   │   └── agents/           ← You are here
│   └── STATE.md              ← Cross-panel activity log
├── kimi-ide-server/          ← WebSocket server
└── kimi-ide-client/          ← React frontend
```

## How It Works

1. Tickets are created in `ai/panels/issues/` and tracked in `issues/index.json`
2. When a ticket is assigned to a bot name (e.g., `kimi-wiki`), the dispatch watcher fires
3. The runner looks up the bot name in `registry.json` → finds the agent folder
4. The runner spawns an orchestrator from the agent's `prompt.md` with the ticket as context
5. The orchestrator delegates steps to sub-agents, evaluates results, retries or approves
6. On completion, the orchestrator closes the ticket and updates `issues/index.json`

## Agent Folder Convention

Each agent is a folder under `agents/`. The folder name is the agent ID.

```
agents/{agent-id}/
├── prompt.md       ← Single instruction file (YAML frontmatter + prompt body)
├── LESSONS.md      ← Agent's living notebook (appended after each run)
└── runs/           ← Execution history (created by the runner)
    └── {timestamp}/
        ├── ticket.md       (frozen copy of triggering ticket)
        ├── prompt.md       (frozen copy of prompt at execution time)
        ├── lessons.md      (frozen copy of LESSONS.md at execution time)
        ├── manifest.json   (run metadata: status, timing, outcome)
        ├── run-index.json  (step-by-step progress tracker)
        ├── 00-validate.md  (evidence card: preflight check)
        ├── 01-{step}.md    (evidence card per step)
        └── ...             (retries: 01-{step}.retry-1.md)
```

## Key Resources

- **Wiki:** `ai/panels/wiki/` — browse topics via `index.json`, read `{topic}/PAGE.md`
- **Tickets:** `ai/panels/issues/` — board state via `index.json`, individual tickets as `KIMI-NNNN.md`
- **Cross-panel state:** `ai/STATE.md` — recent activity from all panels
- **Secrets:** macOS Keychain, account `kimi-ide` — access via `security find-generic-password -a "kimi-ide" -s "KEY_NAME" -w`

## Rules

- Agents read broadly but write only within their declared scope
- The orchestrator delegates to sub-agents — it does not do the work itself
- Sub-agent context is discarded after each step; the orchestrator accumulates decisions
- If confidence drops below the threshold defined in `prompt.md`, stop and mark the ticket
- Never commit directly — report results, let the IDE operator commit
