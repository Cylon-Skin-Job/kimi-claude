---
title: "Workspace Folder Configuration"
status: deferred
relates-to: generic-workspace-router
---

# Workspace Folder Configuration

A JSON file in the workspace root defines which folders exist, their display order, type, and metadata.

## Proposed Schema

```json
{
  "folders": [
    {
      "name": "System",
      "type": "background-agents",
      "icon": "smart_toy",
      "rank": 1,
      "reserved": true
    },
    {
      "name": "My Custom Agents",
      "type": "background-agents",
      "icon": "engineering",
      "rank": 2,
      "reserved": false
    }
  ]
}
```

## Field Definitions

| Field | Purpose |
|-------|---------|
| `name` | Display label + physical folder name |
| `type` | Determines rendering component (immutable unless explicitly changed) |
| `icon` | Material Symbol icon name |
| `rank` | Display order (lower = higher) |
| `reserved` | If true, cannot be deleted or renamed by user |

## Rules

- Changing `name` renames the folder on disk + updates display
- Changing `icon` is cosmetic only
- Changing `type` swaps the rendering component (rare, intentional)
- `reserved: true` folders cannot be deleted or renamed
- System folder is always reserved and ships with default agents

## Applies To All Workspace Types

This same config pattern works for:
- Background agents (agent tile rows)
- Capture (document tile rows)
- Wiki (page viewer)
- Issues (ticket board)
- Future types
