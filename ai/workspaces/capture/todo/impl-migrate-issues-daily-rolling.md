---
title: "Migrate Issues Workspace to Daily-Rolling Strategy"
priority: medium
status: not-started
depends-on: impl-chat-renderer-fix
---

# Migrate Issues Workspace to Daily-Rolling Strategy

The issues workspace currently uses the old `thread:open-daily` code path that creates date-named folders directly. Migrate to use the daily-rolling strategy with UUID folders and `date` field in threads.json.

## Steps

- [ ] Add SESSION.md to `ai/workspaces/issues/` with `thread-model: daily-rolling`
- [ ] Update client: `useTicketData.ts` line 88 — change `thread:open-daily` to `thread:open-agent` or a new generic `thread:open-session` that reads SESSION.md
- [ ] Or: update the `thread:open-daily` server handler to use the daily-rolling strategy internally (less client change)
- [ ] Verify: threads created as UUID folders with date field
- [ ] Clean up any stale date-named thread folders in issues workspace

## Also Consider

- The coding-agent workspace should get a SESSION.md with `thread-model: multi-thread`
- This would make all workspaces use SESSION.md consistently
- The server's `thread:open-daily` handler could be deprecated in favor of strategy-based resolution
