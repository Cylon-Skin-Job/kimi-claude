# Kimi IDE - Style Guide

## Signature Pattern: Cyan Glassmorphism Buttons

This is the **primary interaction pattern** for icon buttons in the Kimi IDE. The visual language is inspired by Tron/Raven OS aesthetics with glassmorphism effects.

---

### The Pattern

```css
/* REQUIRED CSS VARIABLES */
:root {
  --bg-solid: #000000;                           /* Page background */
  --color-primary: #00d4ff;                      /* Cyan accent */
  --border-primary: rgba(0, 212, 255, 0.3);      /* Subtle border */
  --border-glow: rgba(0, 212, 255, 0.6);         /* Bright border */
  --glass-bg: rgba(0, 212, 255, 0.05);           /* Hover background */
}

/* BASE STATE - Transparent, subtle */
.tool-btn {
  background: transparent;
  border: 1px solid var(--border-primary);      /* 30% opacity cyan */
  color: var(--color-primary);
  transition: all 0.2s ease;
}

/* HOVER STATE - Glass background + glow */
.tool-btn:hover {
  background: var(--glass-bg);                    /* 5% opacity cyan */
  border-color: var(--border-glow);               /* 60% opacity cyan */
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.3);    /* Soft glow */
}

/* ACTIVE STATE - Deeper tint + stronger glow */
.tool-btn.active {
  background: rgba(0, 212, 255, 0.15);           /* 15% opacity - 3x deeper */
  border-color: var(--border-glow);               /* Same bright border */
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.4);   /* Stronger: 12px vs 8px, 0.4 vs 0.3 */
}
```

---

### Visual States Breakdown

| State | Background | Border | Glow |
|-------|-----------|--------|------|
| Default | `transparent` | `rgba(0,212,255,0.3)` | None |
| Hover | `rgba(0,212,255,0.05)` | `rgba(0,212,255,0.6)` | `0 0 8px rgba(0,212,255,0.3)` |
| Active | `rgba(0,212,255,0.15)` | `rgba(0,212,255,0.6)` | `0 0 12px rgba(0,212,255,0.4)` |

**The Magic:** The glow intensifies on activation (12px spread, 40% opacity vs 8px/30%), while the background deepens from 5% to 15% opacity. This creates that satisfying "light-up" effect you love.

---

### HTML Usage

```html
<!-- Single icon button -->
<button class="tool-btn" title="Description">
  <span class="material-symbols-outlined">icon_name</span>
</button>

<!-- Example: Tools Panel -->
<nav class="tools-panel">
  <button class="tool-btn" title="Code Blocks">
    <span class="material-symbols-outlined">code_blocks</span>
  </button>
  <button class="tool-btn" title="Smart Toy">
    <span class="material-symbols-outlined">smart_toy</span>
  </button>
</nav>
```

---

### JavaScript Toggle Pattern

```javascript
// Simple toggle for active state
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
  });
});
```

---

### Where to Use This Pattern

- **Tools Panel** (current use) - Left sidebar icon buttons
- **Header Actions** - Top-right action icons
- **Tab Actions** - Close, pin, refresh buttons on tabs
- **Chat Input** - Send button, attachment button
- **Content Area** - Toolbar buttons (diff view, file viewer)

---

### Sizing Variants

```css
/* Small (for inline use) */
.tool-btn-sm {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

/* Medium (default/current) */
.tool-btn {
  width: 44px;
  height: 44px;
  border-radius: 8px;
}

/* Large (for prominent actions) */
.tool-btn-lg {
  width: 56px;
  height: 56px;
  border-radius: 12px;
}
```

---

### Color Variants (Future)

If we need alternate colors for different states/modes:

```css
/* Riff Mode - Blue variant */
.tool-btn.riff:hover {
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);   /* Blue glow */
}

/* Vibe Mode - Green variant */
.tool-btn.vibe:hover {
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.3);    /* Green glow */
}

/* Plan Mode - Purple variant */
.tool-btn.plan:hover {
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.3);    /* Purple glow */
}
```

---

### Why This Works

1. **Subtle at rest** - Doesn't compete with content
2. **Responsive on hover** - Immediate visual feedback
3. **Satisfying when active** - That glow intensifies, background deepens
4. **Consistent rhythm** - All buttons behave the same way
5. **On-brand** - Cyan glow matches the Tron-inspired aesthetic

---

---

## Workspace Color Themes

Each workspace has a **complete color theme** that applies to:
- Border/divider lines
- Button backgrounds and glows
- Chat message bubbles
- Input field borders
- Scrollbar colors
- Active item highlights

### Theme Variables (per workspace)

```css
.workspace-code {
  --ws-primary: #00d4ff;              /* Main accent color */
  --ws-primary-rgb: 0, 212, 255;       /* RGB for opacity mixes */
  --ws-border: rgba(0, 212, 255, 0.3);    /* Subtle borders */
  --ws-border-glow: rgba(0, 212, 255, 0.6); /* Bright borders */
  --ws-glass: rgba(0, 212, 255, 0.05);     /* Hover backgrounds */
  --ws-glass-active: rgba(0, 212, 255, 0.15); /* Active backgrounds */
}
```

### All Workspace Themes

| Workspace | Primary | Border | Use Case |
|-----------|---------|--------|----------|
| Code | `#00d4ff` (Cyan) | Cyan | File editor, diffs |
| Rocket | `#f97316` (Orange) | Orange | Deployments, builds |
| Issues | `#22c55e` (Green) | Green | Tasks, processes |
| Scheduler | `#facc15` (Yellow) | Yellow | Cron jobs, timeline |
| Skills | `#a855f7` (Purple) | Purple | Commands, prompts |
| Wiki | `#ec4899` (Pink) | Pink | Documentation |
| Claw | `#ef4444` (Red) | Red | Direct Kimi chat |

### Dynamic Application

The tools panel border and button active states dynamically change to match the current workspace:

```javascript
// When switching workspaces
function switchWorkspace(workspace) {
  // Apply workspace color to tool buttons
  updateToolButtonStyles(workspace);
  
  // All workspace UI automatically uses CSS variables
  // --ws-primary, --ws-border, etc.
}
```

---

*Documented: 2026-03-01*  
*Location: `docs/STYLE_GUIDE.md`*
