---
title: "GitLab Sync Completion"
priority: medium
status: partially-done
---

# GitLab Sync Completion

Core pull/push/claim works. These are the remaining gaps.

## Tasks

### Bot Account Setup
- [ ] Create GitLab bot accounts (or use project access tokens) for kimi-wiki, kimi-code, kimi-review
- [ ] Add user IDs to sync.json bot_accounts mapping
- [ ] Test: claim pushes bot assignee to GitLab, other instance sees it

### Comments Sync
- [ ] Add comment pulling to pull.js — GET /issues/:iid/notes, append to local ticket
- [ ] Add comment pushing to push.js — POST agent step summaries as comments
- [ ] Decide format: separate comments section in ticket .md, or append to body

### Stale Claim Detection
- [ ] Write a watcher filter or periodic check: find tickets with state: claimed but no active run
- [ ] If claimed > 30 minutes with no run folder activity → release claim
- [ ] Push release to GitLab
