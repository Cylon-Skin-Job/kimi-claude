---
title: "Shared Tile Row Abstraction"
status: deferred
relates-to: generic-workspace-router, workspace-folder-config
---

# Shared Tile Row Abstraction

Extract the tile-row pattern into a fully generic system that works across workspace types.

## Current State

- TileRow + DocumentTile are generic and reusable (proven in capture)
- AgentTiles is a separate component with its own grid layout
- CaptureTiles hardcodes ROWS array

## Target State

A single row renderer that accepts a **tile type** parameter:

| Tile Type | Renders |
|-----------|---------|
| `document` | DocumentTile (file thumbnail preview) |
| `agent` | AgentCard (icon, name, status, color) |
| `wiki-page` | WikiTile (title, summary, freshness) |
| `ticket` | TicketCard (title, assignee, state) |

The row component handles:
- Folder label on the left
- Horizontal scroll for tiles
- Fetch data from filesystem (via WebSocket file_tree_request)
- Delegate rendering to the appropriate tile component based on type

## What Changes
- TileRow gains a `tileType` prop
- Each tile type registers a renderer
- CaptureTiles, AgentTiles, etc. become thin wrappers (or disappear entirely)
- ContentArea routes based on workspace.json type → picks the right tile renderer
