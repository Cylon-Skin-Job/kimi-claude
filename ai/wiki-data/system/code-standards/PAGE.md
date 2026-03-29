# Code Standards

Modularity expectations, file structure rules, and architecture principles. Reference this page during planning phases before writing or modifying code.

---

## File Size Guidance

One job per file, not a line count.

| Size | Action |
|------|--------|
| Under 200 lines | Don't think about it |
| 200-400 lines | Check if it's still one job |
| Over 400 lines | Almost certainly doing too much — split it |

A 350-line SSE controller handling parsing, buffering, and recovery = fine (one job).
A 250-line file rendering UI + calling APIs + managing state = not fine (three jobs).

**The test:** Can you describe what this file does in one sentence without "and"? If not, split it.

---

## Modularity Rules

1. **One job per file.** Not one function — one responsibility. A file can have many functions if they all serve the same job.
2. **No God files.** If a file is the only place where X, Y, and Z happen, it's doing too much.
3. **Imports tell the story.** If a file imports from 5+ unrelated modules, it's probably orchestrating too many concerns.
4. **Extract when the second consumer appears.** Don't pre-extract. Three similar lines of code is better than a premature abstraction. Extract when a second file needs the same thing.
5. **Delete, don't deprecate.** No `_unused` prefixes, no `// removed` comments, no backwards-compatibility shims for one-time operations. If it's dead, delete it.

---

## Architecture Layers

Data flows down. Events flow up. Nothing skips a layer.

```
VIEW (Presentation)
  ├── Pure presentation, renders state, emits user events
  ├── NEVER calls services or APIs directly
  └── NEVER imports controllers or services

CONTROLLER (Orchestration)
  ├── Handles events, orchestrates services, emits results
  ├── NEVER touches DOM directly
  └── NEVER imports view modules

SERVICE (Data Access)
  ├── Pure data access, returns data only
  ├── Called by controllers only
  └── NEVER emits events or touches DOM

STATE (Single Source of Truth)
  ├── Read-only from View, written only by controllers
  └── Emits state.changed on writes
```

**However:** "Layer as little code as possible." Don't build an event bus, controller layer, and service layer if the feature is simple. The layers exist for when complexity demands them, not as mandatory ceremony. A direct function call is fine when the data flow is obvious.

---

## Dependency Rules

```
VIEW may import:     state (read-only), components
VIEW must NOT:       controllers, services, API calls, write state

CONTROLLER may:      state (read/write), services, event bus
CONTROLLER must NOT: views, components, DOM

SERVICE may:         API clients, network
SERVICE must NOT:    event bus, state, controllers, views, DOM

COMPONENT may:       create DOM, accept config/callbacks, use CSS variables
COMPONENT must NOT:  controllers, services, state, network
```

---

## Component Portability

Components are reusable across projects. They must be self-contained.

1. **All styles use CSS variables with fallbacks:** `var(--token, fallback)`
2. **All class names prefixed:** `.rv-toast`, `.rv-modal` (no collisions)
3. **Pure functions:** input (config object) → output (DOM element)
4. **Styles inject once** via flag (prevent duplicate `<style>` tags)
5. **No imports** of controllers, services, app-state, or network
6. **No knowledge** of what project they're in

---

## CSS Rules

1. **NEVER hardcode** colors, spacing, or z-index
2. **NEVER put** component styles in global CSS files — styles live in the component
3. **EVERY value** traces back to CSS variables
4. **Theme switching** only swaps variable values

### Core Token Categories

```css
--palette-*          /* Color palette */
--bg-*               /* Backgrounds */
--text-*             /* Text colors */
--space-xs|sm|md|lg  /* Spacing */
--z-*                /* Z-index layers */
--shadow-*           /* Shadows */
--transition-*       /* Animation durations */
```

---

## Naming Conventions

```
Files:     feature-view.js, feature-controller.js, feature-service.js
           feature.styles.js, feature.template.js

Events:    user.domain.action    (user.thread.created)
           system.domain.action  (system.stream.completed)
           state.changed         ({path, old, new})

CSS vars:  --palette-name, --bg-name, --text-name
           --space-xs|sm|md|lg, --z-layer, --shadow-weight

Classes:   .rv-component, .rv-component-part
```

---

## Anti-Patterns

| Don't | Do |
|-------|----|
| Hidden div in HTML that JS toggles visible | JS creates element on demand |
| View calls `authenticatedFetch()` | Emit event to controller |
| Controller does `document.getElementById()` | Emit event to view |
| Hardcoded color `#FF6B35` | Use `var(--palette-accent, #FF6B35)` |
| Component importing app-state | Accept config object instead |
| One giant app.js | Split into view + controller + service |
| Inline styles on elements | Component injects scoped `<style>` once |
| Add features beyond what was asked | Do what was asked, nothing more |
| Add error handling for impossible scenarios | Trust internal code and framework guarantees |
| Create helpers for one-time operations | Inline it |

---

## Planning Phase Checklist

Before writing code, verify the plan against these standards:

- [ ] Each new file has one job (describable in one sentence without "and")
- [ ] No file will exceed 400 lines
- [ ] Imports don't cross layer boundaries
- [ ] CSS values use variables with fallbacks
- [ ] Components are portable (no app-state, no services, no network)
- [ ] No premature abstractions (is there actually a second consumer?)
- [ ] No scope creep (does this change do more than what was asked?)
