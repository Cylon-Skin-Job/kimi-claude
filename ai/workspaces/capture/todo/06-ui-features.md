---
title: "UI Features"
priority: low
status: not-started
---

# UI Features

Visual improvements and new workspace capabilities.

## Tasks

### Ticket Board Enhancements
- [ ] Blocked ticket indicator — lock icon on cards with blocks/blocked_by
- [ ] Claimed ticket indicator — spinner or pulse on cards with state: claimed
- [ ] Ticket detail panel — click card to see full body, blocking info, run history

### Live File Reload
- [ ] Write watcher filter: `live-reload.md` — watches open files, action: notify
- [ ] Add WebSocket broadcast for file_change events in actions.js
- [ ] Client listens for file_change, refreshes content if the file is currently displayed
- [ ] Wire up to file explorer, wiki page viewer, and capture tile view

### Dynamic Sidebar
- [ ] Read workspaces.json on client boot instead of hardcoded WORKSPACE_CONFIGS
- [ ] Render tabs from workspace.json data (name, icon, color, rank)
- [ ] Remove hardcoded WorkspaceId type — derive from loaded config

### Knowledge Graph
- [ ] Choose graph library (vis.js, cytoscape.js, or d3-force)
- [ ] Build graph data from wiki index.json edges + evidence files
- [ ] Render interactive node-link diagram in wiki workspace
- [ ] Click node → navigate to topic page

### Run History Viewer
- [ ] List past runs per agent (read runs/ directories)
- [ ] Show manifest.json summary (status, timing, outcome)
- [ ] Click run → show evidence cards in step order
- [ ] Diff mode: compare two runs of the same agent
