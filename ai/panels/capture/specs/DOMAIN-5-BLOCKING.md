# Domain 5: Ticket Blocking + Dispatch Enhancements

Adds `blocks` and `blocked_by` fields to the ticketing system. Tickets can block other tickets or block updates to a specific topic/resource. The dispatch watcher respects these constraints — blocked tickets don't fire.

**Prerequisites (all exist):**
- Ticket creation at `ai/workspaces/issues/scripts/create-ticket.js`
- Ticket frontmatter format at `ai/workspaces/issues/KIMI-NNNN.md`
- Dispatch watcher at `kimi-ide-server/lib/tickets/dispatch.js`
- Ticket loader at `kimi-ide-server/lib/tickets/loader.js`
- Issues index at `ai/workspaces/issues/index.json`

**Output:**
- Updated `create-ticket.js` — supports `blocks` and `blocked_by` fields
- Updated `dispatch.js` — checks blocking before dispatch
- Updated `loader.js` — parses new fields
- Updated `index.json` schema — includes blocking fields

---

## New Ticket Fields

### `blocks`

A topic or resource name that this ticket holds a lock on. While this ticket is open, no other ticket targeting the same topic will dispatch.

**Use case:** The wiki-updater creates an edge review ticket after updating a page. The edge ticket has `blocks: secrets` (the topic name). Until the edge review completes, no new content update tickets for the `secrets` topic will dispatch.

```yaml
---
id: KIMI-0015
title: "Edge review: secrets"
assignee: kimi-wiki
blocks: secrets
state: open
---
```

### `blocked_by`

A ticket ID (KIMI-NNNN) that must close before this ticket dispatches.

**Use case:** A parent ticket creates a child ticket for follow-up work. The child is blocked by the parent — it won't run until the parent completes.

```yaml
---
id: KIMI-0016
title: "Update secrets page cross-references"
assignee: kimi-wiki
blocked_by: KIMI-0015
state: open
---
```

---

## Step-by-Step Implementation

### Step 1: Update create-ticket.js

Add `--blocks` and `--blocked-by` CLI options:

```javascript
// In parseArgs:
} else if (argv[i] === '--blocks' && argv[i + 1]) {
  args.blocks = argv[++i];
} else if (argv[i] === '--blocked-by' && argv[i + 1]) {
  args.blockedBy = argv[++i];
}
```

Add to frontmatter generation:
```javascript
const frontmatter = [
  '---',
  `id: ${id}`,
  `title: ${title}`,
  `assignee: ${assignee}`,
  `created: ${created}`,
  `author: local`,
  `state: open`,
];

if (blocks) frontmatter.push(`blocks: ${blocks}`);
if (blockedBy) frontmatter.push(`blocked_by: ${blockedBy}`);

frontmatter.push('---');
```

Add to index.json update:
```javascript
index.tickets[id] = {
  title, assignee, created,
  author: 'local', state: 'open',
  body: (body || '').trim(),
  blocks: blocks || null,
  blocked_by: blockedBy || null,
};
```

Also update the `createTicket` function signature to accept these fields when called as a module:
```javascript
function createTicket({ title, assignee, body, blocks, blockedBy }) { }
```

### Step 2: Update loader.js

The frontmatter parser already handles arbitrary fields, but make the new fields explicit in the return type:

```javascript
// In loadTicket, after parsing frontmatter:
return {
  frontmatter: {
    ...frontmatter,
    blocks: frontmatter.blocks || null,
    blocked_by: frontmatter.blocked_by || null,
  },
  body: match[2].trim(),
  filename: path.basename(filePath),
};
```

### Step 3: Update Dispatch Logic

Replace the `shouldDispatch` function in `dispatch.js`:

```javascript
function shouldDispatch(ticket, registry, allTickets) {
  if (!ticket || !ticket.frontmatter) return false;
  if (ticket.frontmatter.state !== 'open') return false;

  const assignee = ticket.frontmatter.assignee;
  const agent = registry.agents[assignee];
  if (!agent) return false;  // assigned to human, skip

  // Check: is this ticket directly blocked by another ticket?
  if (ticket.frontmatter.blocked_by) {
    const blocker = allTickets.find(t =>
      t.frontmatter.id === ticket.frontmatter.blocked_by &&
      t.frontmatter.state === 'open'
    );
    if (blocker) {
      console.log(`  Blocked by ${ticket.frontmatter.blocked_by}`);
      return false;
    }
  }

  // Check: is the topic this ticket targets blocked by another ticket?
  const topic = extractTopic(ticket);
  if (topic) {
    const topicBlocker = allTickets.find(t =>
      t.frontmatter.blocks === topic &&
      t.frontmatter.state === 'open' &&
      t.frontmatter.id !== ticket.frontmatter.id
    );
    if (topicBlocker) {
      console.log(`  Topic "${topic}" blocked by ${topicBlocker.frontmatter.id}`);
      return false;
    }
  }

  return true;
}
```

### Step 4: Topic Extraction

The dispatch logic needs to figure out which topic a ticket targets. This is derived from the ticket title or a dedicated field:

```javascript
function extractTopic(ticket) {
  const title = ticket.frontmatter.title || '';

  // Check for explicit topic patterns in the title
  // "Edge review: secrets" → "secrets"
  // "Update secrets page token expiry" → "secrets" (if it matches a known topic)
  // "Daily wiki freshness check" → null (broad, not topic-specific)

  const edgeMatch = title.match(/^Edge review:\s*(.+)$/i);
  if (edgeMatch) return edgeMatch[1].trim();

  // Could also check the ticket body for topic references
  // For now, explicit patterns in the title are sufficient
  return null;
}
```

**Future enhancement:** Add a `topic` field to ticket frontmatter for explicit targeting. The wiki-updater would set this when creating edge tickets.

### Step 5: Update Dispatch Watcher

The dispatch watcher currently checks tickets one at a time. With blocking, it needs to load all tickets and pass them to `shouldDispatch`:

```javascript
// In the fs.watch handler, after loading the changed ticket:
const allTickets = loadAllTickets(issuesDir);
const registry = loadRegistry(projectRoot);

if (shouldDispatch(ticket, registry, allTickets)) {
  dispatch(ticket, registry);
}
```

### Step 6: Update Index Schema

When `create-ticket.js` writes to `index.json`, include the blocking fields so the UI can show them:

```json
{
  "KIMI-0015": {
    "title": "Edge review: secrets",
    "assignee": "kimi-wiki",
    "state": "open",
    "blocks": "secrets",
    "blocked_by": null,
    ...
  }
}
```

### Step 7: Clearing Blocks

When a blocking ticket is closed (moved to `done/`):
1. The block is automatically released — `shouldDispatch` checks live state, so the next dispatch cycle will see the blocker is gone
2. No explicit "unblock" action needed
3. Any tickets that were waiting on this blocker will dispatch on the next watcher cycle

---

## Module Interface

No new module — this modifies existing files:

```javascript
// dispatch.js — updated exports
module.exports = {
  startDispatchWatcher,
  shouldDispatch,  // now takes (ticket, registry, allTickets)
};

// create-ticket.js — updated function signature
function createTicket({ title, assignee, body, blocks, blockedBy }) { }
```

---

## Test Plan

### Test 1: Direct blocking (blocked_by)

1. Create ticket A: `--title "Parent task" --assignee kimi-wiki`
2. Create ticket B: `--title "Child task" --assignee kimi-wiki --blocked-by KIMI-{A's ID}`
3. Start dispatch watcher
4. Verify: ticket A dispatches, ticket B logs "Blocked by KIMI-{A}"
5. Move ticket A to `done/`
6. Verify: ticket B dispatches on next cycle

### Test 2: Topic blocking (blocks)

1. Create ticket C: `--title "Edge review: secrets" --assignee kimi-wiki --blocks secrets`
2. Create ticket D: `--title "Update secrets page" --assignee kimi-wiki`
3. Start dispatch watcher
4. Verify: ticket C dispatches, ticket D logs "Topic 'secrets' blocked by KIMI-{C}"
5. Move ticket C to `done/`
6. Verify: ticket D dispatches on next cycle

### Test 3: No false blocks

1. Create ticket E: `--title "Update home page" --assignee kimi-wiki`
2. While ticket C (blocking "secrets") is open, verify ticket E dispatches normally (different topic)

---

## Key Files

| File | Action |
|------|--------|
| `ai/workspaces/issues/scripts/create-ticket.js` | **Modify** — add blocks/blocked_by support |
| `kimi-ide-server/lib/tickets/dispatch.js` | **Modify** — check blocking in shouldDispatch |
| `kimi-ide-server/lib/tickets/loader.js` | **Modify** — parse new frontmatter fields |
| `ai/workspaces/capture/specs/TICKETING-SPEC.md` | **Already updated** — documents blocks/blocked_by |

---

## What This Does NOT Build

- Topic field on tickets (uses title pattern matching for now)
- UI indicators for blocked tickets (future: show a lock icon on blocked cards)
- Automatic block creation (agents create blocks via create-ticket.js)
- Timeout on blocks (a stale block stays until the blocking ticket is manually closed)
