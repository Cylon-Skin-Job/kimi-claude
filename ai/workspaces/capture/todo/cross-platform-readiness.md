---
title: Cross-Platform Readiness (Windows + Linux)
type: todo
priority: high
status: open
created: 2026-03-26
---

# Cross-Platform Readiness

Everything needed to run on Windows and Linux alongside macOS. Target: Electron wrapper that works identically on all three platforms.

---

## 1. File Paths — Use `path.join()` Everywhere

**Problem:** macOS/Linux use `/`, Windows uses `\`. Hardcoded `/` in path strings breaks on Windows.

**Status:** Mostly good — server.js uses `path.join()`. Need audit of:
- [ ] All `path.join()` usage in server.js (grep for string concatenation with `/`)
- [ ] Client-side paths sent over WebSocket (e.g., `workspace + '/' + folder`)
- [ ] Bot scripts that construct paths
- [ ] Any hardcoded `/Users/` references

**Windows path length:** 260 char default limit. Deep workspace paths can hit it. Electron manifest can opt out (`longPathAware: true`).

---

## 2. Shell Scripts → Node.js Scripts

**Problem:** `.sh` files don't run on Windows. PowerShell and cmd.exe have completely different syntax.

**Current `.sh` scripts to convert:**
- [ ] `ai/scripts/git-credential-kimi.sh` → `git-credential-kimi.js`
- [ ] `ai/scripts/sync-wiki.sh` → `sync-wiki.js`
- [ ] `restart-kimi.sh` → `restart-kimi.js` (or make it a package.json script)

**Already `.js` (no change needed):**
- `ai/scripts/capture-wire-output.js`
- `ai/scripts/setup-secrets.js`

**Rule going forward:** All new scripts must be `.js`. No `.sh` files. Bot scripts in agent folders must be `.js`.

**Terminal commands via package.json:**
```json
{
  "bin": {
    "kimi-restart": "./scripts/restart.js",
    "kimi-enrich": "./ai/scripts/enrich.js",
    "kimi-sync-wiki": "./ai/scripts/sync-wiki.js",
    "kimi-setup-secrets": "./ai/scripts/setup-secrets.js",
    "kimi-credential": "./ai/scripts/git-credential-kimi.js"
  }
}
```

After `npm link`, these become terminal commands on all platforms.

---

## 3. Secrets Management — `safeStorage` for Electron

**Problem:** Currently uses macOS Keychain via `security` CLI commands. Doesn't exist on Windows/Linux.

**Solution:** Electron's `safeStorage` API — one API, three platforms:
- macOS → Keychain
- Windows → DPAPI
- Linux → libsecret (GNOME Keyring / KDE Wallet)

**Migration:**
- [ ] Abstract current secrets manager behind an interface
- [ ] Implement `safeStorage` backend for Electron
- [ ] Keep `security` CLI backend as fallback for non-Electron (dev mode)
- [ ] Encrypted blobs stored as files in a known location
- [ ] Bot scripts call the same interface regardless of platform

---

## 4. Terminal / Shell Spawning

**Problem:** macOS defaults to `zsh`, Linux to `bash`, Windows to `PowerShell`. No `ls`, `grep`, `cat` on Windows cmd.

**Solution:** Detect platform when spawning PTY:
```js
const shell = process.platform === 'win32'
  ? 'powershell.exe'
  : process.env.SHELL || '/bin/bash';
```

**CLI login flows:** `kimi login` and `claude login` open a browser. Works on all platforms from an Electron-spawned terminal since it uses the user's real OS browser.

- [ ] Shell detection in terminal workspace
- [ ] Test CLI login flows on Windows (browser popup)
- [ ] Ensure `node-pty` compiles via `electron-rebuild` on all platforms

---

## 5. Symlinks / Junctions

**Problem:** macOS/Linux symlinks just work. Windows requires Developer Mode or admin for symlinks. Directory junctions (`mklink /J`) work without admin but are Windows-only.

**Current state:** Server already handles symlinks + junctions via `lstat` fallback. `folder_special` icon shows for linked folders on all platforms.

**Remaining:**
- [ ] Wiki setup wizard: add Windows-specific `mklink /J` instructions
- [ ] If auto-setup feature is added: detect `process.platform` and use `mklink /J` on Windows
- [ ] Test that `isPathAllowed` follows junctions correctly on Windows
- [ ] Document that Windows users need to use junctions, not symlinks, unless they have Developer Mode

---

## 6. File Watching

**Problem:** Different mechanisms per platform:
- macOS: FSEvents (reliable, efficient)
- Linux: inotify (reliable, but default watch limit ~8192 — deep workspace trees can exhaust it)
- Windows: ReadDirectoryChangesW (works but can miss rapid changes, doesn't handle symlinks well)

**Current state:** Server uses `fs.watch`. Works on all platforms with caveats.

**Remaining:**
- [ ] Linux: document how to increase inotify limit (`fs.inotify.max_user_watches`)
- [ ] Windows: test file watcher through junctions
- [ ] Consider `chokidar` as a more robust cross-platform watcher if `fs.watch` proves unreliable

---

## 7. Line Endings

**Problem:** macOS/Linux use `\n`. Windows uses `\r\n`. Text parsers that split on `\n` leave trailing `\r` on Windows.

**Affected code:**
- [ ] `src/lib/text/chunk-boundary.ts` — boundary detection splits on `\n`
- [ ] `src/lib/reveal/parsers/line-break.ts` — chunks on `\n`
- [ ] `src/lib/text/renderers/list.ts` — list detection
- [ ] `src/lib/text/renderers/header.ts` — header detection
- [ ] `src/lib/text/renderers/code-fence.ts` — fence detection
- [ ] Server-side ChatFile/HistoryFile parsers
- [ ] Any `.split('\n')` calls throughout the codebase

**Fix:** Normalize line endings on read, or handle both `\n` and `\r\n` in all parsers. Add `.gitattributes` with `* text=auto` to normalize in git.

---

## 8. CLI Path Detection

**Problem:** macOS/Linux find CLIs via `$PATH` and `which`. Windows `$PATH` works differently, `which` doesn't exist (use `where` instead).

**Solution:**
- [ ] At startup, detect installed CLIs using `process.platform`-aware lookup
- [ ] Store discovered CLI paths in config
- [ ] Don't assume `which` — use `where` on Windows or `child_process.execSync` with error handling
- [ ] For Electron: optionally bundle CLIs with the app

---

## 9. File Permissions

**Problem:** macOS/Linux have `chmod` and executable bits. Windows doesn't.

**Fix:**
- [ ] Don't rely on `+x` for scripts — always use `node script.js` explicitly
- [ ] Bot trigger system should invoke scripts as `node <path>`, not `./<path>`

---

## 10. Process Management

**Problem:** `lsof -ti:3001 | xargs kill -9` (in restart script) is Unix-only.

**Fix (when converting restart-kimi.sh to .js):**
```js
// Cross-platform port kill
const { execSync } = require('child_process');
if (process.platform === 'win32') {
  execSync('netstat -ano | findstr :3001 | ... taskkill', { stdio: 'ignore' });
} else {
  execSync('lsof -ti:3001 | xargs kill -9', { stdio: 'ignore' });
}
```

Or use a library like `kill-port` (npm package, cross-platform).

- [ ] Convert restart script to Node.js with platform detection
- [ ] Or use `kill-port` package

---

## Priority Order

1. **Shell scripts → Node.js** (blocks everything else on Windows)
2. **Line endings** (silent corruption if not handled)
3. **Path separators audit** (same — silent breakage)
4. **Secrets manager abstraction** (needed before Electron wrap)
5. **Terminal shell detection** (needed for terminal workspace)
6. **Symlink/junction documentation** (wiki + setup wizard)
7. **CLI detection** (needed for first-run experience)
8. **File watching** (test and document)
9. **File permissions** (script invocation pattern)
10. **Process management** (restart script conversion)
