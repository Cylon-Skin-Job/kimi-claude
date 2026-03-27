# Project State

## 2026-03-20 — wiki
Created wiki workspace with topic folder structure.
Topics: home, secrets, gitlab, wiki-system (4 pages, all synced to GitLab).
Source: secrets manager implementation session.
Loose thread: wiki agent files (PROMPT.md, TOOLS.md, WORKFLOW.md) not yet written for wiki workspace.

## 2026-03-20 — code
Implemented local secrets manager (lib/secrets.js).
Rotated GITLAB_TOKEN, new expiry 2026-06-20. Old token invalidated.
Created kimi-claude GitLab project (id: 80453361), added as `gitlab` remote.
Set up git credential helper for gitlab.com (cache + Keychain).
