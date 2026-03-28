---
title: "Fix inverted dependency direction in lib/ws-client.ts"
type: task
priority: low
status: open
created: 2026-03-26
relates-to: WS_CLIENT_EXTRACTION, path-resolution
---

# Fix Inverted Dependency Direction

## Problem

`lib/ws-client.ts` imports upward into `hooks/` and `components/`:

```
lib/ws-client.ts
  → hooks/useFileTree.ts   (loadRootTree)
  → components/Toast.tsx   (showToast)
```

This inverts the expected `components → hooks → lib → state` flow. If either of those files ever imports from `ws-client.ts` (directly or transitively), the app breaks with a circular dependency.

## Plan

### Step 1: Move `showToast` to `lib/toast.ts`

`showToast` is already a standalone function — it appends a DOM element and removes it after a timeout. It has no React dependency. The React `<Toast />` component in App.tsx just provides a mount point.

- Create `lib/toast.ts` with the `showToast` function
- `components/Toast.tsx` re-exports from `lib/toast.ts` (or just renders the container)
- `ws-client.ts` imports from `lib/toast.ts` instead of `components/Toast.tsx`

### Step 2: Move `loadRootTree` to `lib/file-tree.ts`

`loadRootTree` is a standalone function that reads `ws` from the store and sends a WebSocket message. It's not a hook — it's called imperatively. It just happens to live in `hooks/useFileTree.ts`.

- Extract `loadRootTree` into `lib/file-tree.ts`
- `hooks/useFileTree.ts` imports and re-exports it (no breaking changes for existing callers)
- `ws-client.ts` imports from `lib/file-tree.ts`

### Step 3: Verify no upward imports remain in `lib/`

```bash
grep -r "from '\.\./hooks/\|from '\.\./components/" src/lib/
```

Should return zero results.

## Scope

- 2 new files (~20 lines each, just moved code)
- 2 modified files (update imports)
- 0 behavioral changes
- Low risk, can be done anytime
