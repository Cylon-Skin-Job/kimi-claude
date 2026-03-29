# Cascading Settings

> You're never stuck with settings that don't apply to your context. Build view shows your heavies. Wiki view shows your readers. Each view is tailored without duplicating everything.

---

## The Pattern

Settings files live at a global path. Any view can override them by placing the same filename at a view-specific path. The server resolves settings by checking the view-specific path first, then falling back to the global path.

```
Global settings:       ai/views/chat/settings/
View-specific override: ai/views/{viewer}/chat/settings/
```

Drop a file in the view-specific folder and it takes precedence. Leave it out and the global version applies automatically.

---

## Resolution Order

For any settings file, the server resolves in this order:

```
1. ai/views/{viewer}/chat/settings/{file}   ← view-specific (wins if present)
2. ai/views/chat/settings/{file}             ← global fallback
3. Built-in defaults                          ← hardcoded in server
```

The first match wins. No merging happens at the resolution level — the behavior of each file determines whether it replaces or extends the global.

---

## Override vs Additive

The cascading behavior is defined **per-file**, not globally. Two modes exist:

### Override (Replace)

The view-specific file completely replaces the global file.

**Example:** `profiles.json` — the build viewer only shows heavyweight models. Its `profiles.json` contains only those profiles, and the global list is ignored entirely.

```
ai/views/chat/settings/profiles.json          ← all profiles (global)
ai/views/build-viewer/chat/settings/profiles.json  ← heavies only (replaces global)
```

### Additive (Extend)

The view-specific entries appear alongside the global entries.

**Example:** `prompts/` — a view can add its own system prompts without losing access to global prompts. Both sets are available.

```
ai/views/chat/settings/prompts/general.md           ← available everywhere
ai/views/wiki-viewer/chat/settings/prompts/wiki.md  ← available only in wiki view
```

In the wiki view, both `general.md` and `wiki.md` are available. In any other view, only `general.md` appears.

---

## Universal Files

Some settings files are system facts and are **never overridden**. They exist only at the global level.

**Example:** `clis.json` — which CLIs are signed in is an objective fact about the system, not a per-view preference. There is no reason for the build view to see different CLIs than the wiki view.

```
ai/views/chat/settings/clis.json    ← exists here only
ai/views/{viewer}/chat/settings/    ← no clis.json allowed
```

The server does not check the view-specific path for universal files.

---

## Current Settings Files

| File | Type | Behavior | Description |
|------|------|----------|-------------|
| `clis.json` | Universal | Never overridden | Signed-in CLIs — system fact |
| `profiles.json` | Override | Replaces global | Custom API provider profiles |
| `prompts/` | Additive | Extends global | System prompt `.md` files |

---

## How to Add a New View

1. Create the view-specific settings directory:

```
ai/views/{viewer-name}/chat/settings/
```

2. Drop in **only** the files you want to override or extend. Everything else falls through to global defaults.

3. That's it. The server handles resolution automatically.

**Example:** Creating a `docs-viewer` that uses a specific set of profiles but inherits all global prompts:

```
ai/views/docs-viewer/chat/settings/
  profiles.json    ← custom profiles for this view
                   ← no prompts/ folder — inherits global prompts
                   ← no clis.json — universal, not overridable
```

---

## The Principle

Each view is a lens on the same system. The cascading pattern lets every view be tailored to its purpose without duplicating configuration. Override what matters. Inherit the rest. Never fight settings that don't belong in your context.
