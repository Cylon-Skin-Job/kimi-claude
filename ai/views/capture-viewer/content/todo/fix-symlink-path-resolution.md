---
title: "Fix path resolution security check to support symlinks"
type: task
priority: medium
status: open
created: 2026-03-26
relates-to: path-resolution, workspace-agent-model
---

# Fix Symlink Path Resolution

## Problem

The security check in `server.js:321` uses `path.resolve()` to prevent path traversal attacks. But `path.resolve()` follows symlinks to their canonical (real) path. Any symlink pointing outside the workspace folder fails the `startsWith(basePath)` check and gets rejected as a traversal attempt.

This will block the planned agent session symlinks (e.g., `background-agents/sessions → ~/.kimi/sessions/`).

## Current code

```js
// server.js handleFileContentRequest
const basePath = path.resolve(workspacePath);
const targetPath = path.join(basePath, requestPath);

if (!path.resolve(targetPath).startsWith(basePath)) {
  // REJECTED — looks like path traversal
}
```

## Plan

### Option A: Resolve basePath through symlinks too (simplest)

Replace `path.resolve(workspacePath)` with `fs.realpathSync(workspacePath)`. This way if `workspacePath` itself is a symlink, `basePath` follows it too, and the `startsWith` check works.

**Limitation:** Only fixes the case where the workspace root is a symlink. Doesn't fix symlinks *inside* the workspace folder (like `sessions/` → external path).

### Option B: Two-pass check (recommended)

Check the logical path first (no symlink resolution), then optionally resolve symlinks for known-safe patterns.

```js
const basePath = path.resolve(workspacePath);
const targetPath = path.join(basePath, requestPath);
const logicalTarget = path.resolve(targetPath);

// Pass 1: Logical path must stay within workspace
if (!logicalTarget.startsWith(basePath)) {
  return reject('Invalid path');
}

// Pass 2: If logical path is a symlink, check if it resolves to an allowed target
if (fs.lstatSync(logicalTarget).isSymbolicLink()) {
  const realTarget = fs.realpathSync(logicalTarget);
  // Allow if target is within workspace OR within known safe roots
  const safeRoots = [basePath, ...getAllowedSymlinkTargets(workspace)];
  if (!safeRoots.some(root => realTarget.startsWith(root))) {
    return reject('Symlink target not allowed');
  }
}
```

### Option C: Workspace-level allowlist in workspace.json

Add a `symlinks` field to `workspace.json`:

```json
{
  "id": "background-agents",
  "symlinks": {
    "sessions": "~/.kimi/sessions/"
  }
}
```

Server reads this on workspace init and registers allowed external paths. Most explicit, most secure.

## Recommendation

Start with Option B. It maintains security for non-symlink paths while allowing controlled symlink traversal. Option C can be added later if multiple workspaces need symlinks.

## Files to modify

- `kimi-ide-server/server.js` — `handleFileContentRequest` and `handleFileTreeRequest` (both have the same check)

## Verification

1. Create a symlink inside a workspace: `ln -s /tmp/test-target ai/workspaces/background-agents/test-link`
2. Request the file via WebSocket: `{ type: 'file_content_request', workspace: 'background-agents', path: 'test-link/file.txt' }`
3. Should succeed (currently fails)
4. Request `../../etc/passwd` — should still be rejected
5. Remove symlink after testing
