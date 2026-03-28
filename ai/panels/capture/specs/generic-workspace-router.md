---
title: "Generic Workspace Router"
status: deferred
relates-to: impl-phase-1-folder-restructure, impl-phase-6-chat-integration
---

# Generic Workspace Router

Replace hardcoded workspace routing in ContentArea.tsx with a type-driven system.

## Current State

ContentArea.tsx routes by workspace ID:
```
if (workspace === 'capture') → CaptureTiles
if (workspace === 'claw') → AgentTiles
```

Each workspace type has a hardcoded component mapping.

## Target State

A root-level JSON file (or workspace.json) defines folders with rank, icon, name, and **type**. The type drives which display component renders:

| Type | Display |
|------|---------|
| `wiki` | Wiki page viewer |
| `background-agents` | Agent tile rows |
| `capture` | Document tile rows |
| `coding-agent` | Code agent with threads |
| `issues` | Ticket board |

The name, icon, and rank are configurable. The type determines rendering behavior. You can rename a folder, change its icon — the type stays and the display stays consistent.

## Future Types (Ideas)
- JSON viewer (scientific studies, books, literature)
- Email workspace
- Calendar workspace
- Custom user-defined types

## What This Enables
- User-created folders alongside system folders
- Drag-to-reorder via rank
- Any workspace can contain any folder type
- New types added by registering a component against a type string

## Compatibility Notes
- Phase 1 folder structure (System/wiki-manager, etc.) is already compatible
- Display metadata in styles.css per agent — no index.json dependency
- When this lands, ContentArea checks workspace.json type field instead of hardcoded IDs
