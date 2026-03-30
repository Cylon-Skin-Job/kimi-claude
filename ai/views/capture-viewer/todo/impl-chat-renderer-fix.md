---
title: "Fix Chat Renderer"
priority: critical
status: not-started
blocks: impl-e2e-testing, client-side agent UI
---

# Fix Chat Renderer

The chat renderer needs to be fixed before any client-side agent UI work or end-to-end testing can begin. This was intentionally deferred until the agent backend was built.

## Scope

- Fix the existing chat rendering pipeline
- Ensure streaming content displays correctly
- Ensure thread history replay works

## Blocked By This

- End-to-end testing of agent persona chat
- Client-side UI for agent tile click → chat panel
- Migrating issues workspace to daily-rolling strategy (needs working chat to verify)
