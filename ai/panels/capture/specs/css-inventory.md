# CSS Inventory - kimi-ide-server/public/index.html

**Source File:** `kimi-ide-server/public/index.html`  
**Style Tag Lines:** 1037 lines of CSS  
**Generated:** March 1, 2026

---

## Table of Contents

1. [CSS Variables](#1-css-variables)
   - [:root Variables](#root-variables)
   - [Theme Variables](#theme-variables)
2. [Keyframe Animations](#2-keyframe-animations)
3. [Component Classes](#3-component-classes)
   - [Layout Components](#layout-components)
   - [Header Components](#header-components)
   - [Tools Panel](#tools-panel)
   - [Sidebar Components](#sidebar-components)
   - [Chat Area Components](#chat-area-components)
   - [Message Components](#message-components)
   - [Markdown/Code Rendering](#markdowncode-rendering)
   - [Workspace System](#workspace-system)
   - [Animation Components](#animation-components)
4. [Layout System](#4-layout-system)
5. [Color System](#5-color-system)
6. [Utility Classes](#6-utility-classes)

---

## 1. CSS Variables

### :root Variables

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-solid` | `#000000` | Page background (solid black) |
| `--color-primary` | `#00d4ff` | Primary cyan accent color |
| `--color-secondary` | `#00a8cc` | Secondary cyan shade |
| `--border-primary` | `rgba(0, 212, 255, 0.3)` | Subtle borders at 30% opacity |
| `--border-glow` | `rgba(0, 212, 255, 0.6)` | Hover/active border glow at 60% opacity |
| `--glass-bg` | `rgba(0, 212, 255, 0.05)` | Glass morphism hover background |
| `--text-white` | `#ffffff` | Primary text color |
| `--text-dim` | `rgba(255, 255, 255, 0.6)` | Secondary/dimmed text |
| `--header-height` | `60px` | Header row height |
| `--tools-width` | `60px` | Tools panel width |
| `--sidebar-width` | `250px` | Sidebar width |
| `--chat-width` | `400px` | Chat panel width |

### Theme Variables

Dynamic variables set by JavaScript when workspace switches:

| Variable | Purpose | Fallback |
|----------|---------|----------|
| `--theme-primary` | Solid color for buttons, text, accents | `--color-primary` |
| `--theme-primary-rgb` | RGB version for opacity calculations | `0, 212, 255` |
| `--theme-border` | 30% opacity for subtle borders | `--border-primary` |
| `--theme-border-glow` | 60% opacity for hover/active states | `--border-glow` |

### Workspace Color Mapping

| Workspace | Hex Color | RGB Values |
|-----------|-----------|------------|
| `code` | `#00d4ff` | `0, 212, 255` |
| `rocket` | `#f97316` | `249, 115, 22` |
| `issues` | `#facc15` | `250, 204, 21` |
| `scheduler` | `#22c55e` | `34, 197, 94` |
| `skills` | `#a855f7` | `168, 85, 247` |
| `wiki` | `#ec4899` | `236, 72, 153` |
| `claw` | `#ef4444` | `239, 68, 68` |

---

## 2. Keyframe Animations

### `@keyframes blink`
**Purpose:** Streaming cursor blink animation
```css
0%, 50% { opacity: 1; }
51%, 100% { opacity: 0; }
```
**Duration:** 1s infinite

### `@keyframes shimmer`
**Purpose:** Thinking header pulse animation
```css
0% { opacity: 0.4; }
50% { opacity: 1; }
100% { opacity: 0.4; }
```
**Duration:** 1.5s ease-in-out infinite

### `@keyframes ribbon-enter`
**Purpose:** Ribbon dart in from left
```css
0% { left: -100px; opacity: 0; }
100% { left: 50%; transform: translateX(-50%); opacity: 1; }
```
**Duration:** 150ms ease-out forwards

### `@keyframes ribbon-pulse`
**Purpose:** Ribbon hold with pulse
```css
0%, 100% { opacity: 0.8; box-shadow: 0 0 20px var(--theme-primary); }
50% { opacity: 1; box-shadow: 0 0 30px var(--theme-primary), 0 0 50px var(--theme-primary); }
```
**Duration:** 800ms ease-in-out infinite

### `@keyframes ribbon-exit`
**Purpose:** Ribbon dart out to right
```css
0% { left: 50%; transform: translateX(-50%); opacity: 1; }
100% { left: calc(100% + 100px); transform: translateX(0); opacity: 0; }
```
**Duration:** 200ms ease-in forwards

### `@keyframes lens-pulse-continuous`
**Purpose:** Continuous pulse for waiting state
```css
0% { transform: scale(1); opacity: 0.8; }
50% { transform: scale(0.6); opacity: 0.5; }
100% { transform: scale(1); opacity: 0.8; }
```
**Duration:** 1.2s ease-in-out infinite

### `@keyframes lens-pulse-once`
**Purpose:** Single pulse cycle for transitions
```css
0% { transform: scale(1); opacity: 0.8; }
50% { transform: scale(0.6); opacity: 0.5; }
100% { transform: scale(1); opacity: 0.8; }
```
**Duration:** 0.8s ease-in-out

---

## 3. Component Classes

### Layout Components

#### `.app-container`
- **Display:** CSS Grid
- **Grid Template:** `60px 1fr` (rows) / `60px 250px 400px 1fr` (columns)
- **Purpose:** Main application layout wrapper
- **Theme Border:** 1px solid at 30% opacity

#### `.workspaces-container`
- **Grid Column:** 2 / -1 (spans remaining columns)
- **Grid Template:** `250px 400px 1fr`
- **Purpose:** Container for workspace views

#### `.workspace`
- **Display:** `contents` (participates in parent grid)
- **States:** `.hidden` - display none

---

### Header Components

#### `.header`
- **Grid Column:** 1 / -1 (spans all columns)
- **Display:** Flex with space-between
- **Border Bottom:** Theme border at 30% opacity
- **Box Shadow:** Theme glow at 10% opacity

#### `.header-left`
- **Display:** Flex with 12px gap
- **Contains:** Menu button, project name

#### `.header-right`
- **Display:** Flex with 8px gap
- **Contains:** Connection status, context usage

#### `.menu-btn`
- **Size:** 40x40px
- **Border:** 1px solid theme border (30%)
- **Border Radius:** 8px
- **Hover:** Glass background (5% opacity), border glow (60%), box-shadow glow

#### `.project-name`
- **Font Size:** 16px, Weight: 500
- **Color:** Theme primary
- **Letter Spacing:** 0.5px

#### `.connection-status`
- **Font Size:** 12px
- **Default Color:** Text dim
- **Connected State:** Theme primary with dot indicator
- **Pseudo Element:** 8px circle before text

#### `.context-usage-container`
- **Display:** Flex with 8px gap
- **Padding:** 4px 10px
- **Background:** Theme RGB at 5% opacity
- **Border:** 1px solid theme border (30%)
- **Border Radius:** 6px

#### `.context-usage-bar`
- **Size:** 60x6px
- **Background:** White at 10% opacity
- **Border Radius:** 3px

#### `.context-usage-fill`
- **Background:** Theme primary
- **States:**
  - `.high` - Orange (#f97316) at 80%+
  - `.critical` - Red (#ef4444) at 95%+

---

### Tools Panel

#### `.tools-panel`
- **Background:** Solid black
- **Border Right:** Theme border at 30% opacity
- **Display:** Flex column, centered items
- **Padding:** 12px 0
- **Gap:** 8px between buttons

#### `.tool-btn`
- **Size:** 44x44px
- **Border:** 1px solid theme border (30%)
- **Border Radius:** 8px
- **Color:** Theme primary
- **Transition:** all 0.2s ease
- **States:**
  - `:hover` - Glass background (5%), border glow (60%), box-shadow
  - `.active` - Deeper tint (15%), stronger glow, stays lit

---

### Sidebar Components

#### `.sidebar`
- **Background:** Solid black
- **Border Right:** Primary border at 30% opacity
- **Display:** Flex column
- **Purpose:** Chat list sidebar

#### `.sidebar-header`
- **Padding:** 12px
- **Border Bottom:** Primary border

#### `.new-chat-btn`
- **Width:** 100%
- **Padding:** 10px 12px
- **Display:** Flex with 8px gap
- **Background:** Glass background
- **Border:** 1px solid primary border
- **Border Radius:** 8px
- **Hover:** 10% cyan tint, border glow

#### `.chat-list`
- **Flex:** 1
- **Overflow:** Auto scroll
- **Padding:** 8px

#### `.chat-item`
- **Display:** Flex with 8px gap
- **Padding:** 10px 0 10px 12px
- **Margin Bottom:** 4px
- **Border Radius:** 8px
- **States:**
  - `:hover` - Glass background
  - `.active` - 10% cyan tint, 1px border

#### `.chat-item-ellipsis`
- **Opacity:** 0.5 default
- **Margin Left:** auto (right alignment)
- **Hover:** Full opacity, primary color

#### `.chat-item-text`
- **Flex:** 1
- **Font Size:** 14px
- **Text Overflow:** Ellipsis with nowrap

---

### Chat Area Components

#### `.chat-area`
- **Background:** Solid black
- **Border Right:** Primary border
- **Display:** Flex column
- **Overflow:** Hidden

#### `.chat-messages`
- **Flex:** 1
- **Overflow:** Auto scroll
- **Padding:** 16px
- **Display:** Flex column with 12px gap

#### `.chat-input-container`
- **Padding:** 12px
- **Border Top:** Theme border at 30%

#### `.chat-input-wrapper`
- **Display:** Flex with 8px gap, align-items: flex-end
- **Background:** Theme RGB at 5% opacity
- **Border:** 1px solid theme border (30%)
- **Border Radius:** 20px (pill shape)
- **Padding:** 8px 12px
- **Focus State:** Border glow at 60%

#### `.chat-input`
- **Flex:** 1
- **Background:** Transparent
- **Border:** None
- **Color:** White
- **Font Size:** 14px
- **Min/Max Height:** 20px / 120px
- **Placeholder:** Dim text color

#### `.send-btn`
- **Size:** 32x32px
- **Background:** Theme primary (solid)
- **Border Radius:** 50%
- **Color:** Black (solid bg contrast)
- **Hover:** Box-shadow glow

---

### Message Components

#### `.message`
- **Max Width:** 100%

#### `.message-user`
- **Align Self:** Flex-end (right side)
- **Background:** Theme RGB at 15% opacity
- **Border:** 1px solid theme border (30%)
- **Border Radius:** 16px
- **Padding:** 12px 16px
- **Max Width:** 85%

#### `.message-assistant`
- **Align Self:** Flex-start (left side)
- **Line Height:** 1.6
- **Max Width:** 100%

#### `.message-assistant .bubble`
- **Background:** Theme RGB at 5% opacity (or green at 5% for base)
- **Padding:** 12px
- **Border Radius:** 8px
- **White Space:** Pre-wrap
- **Word Break:** Break-word

#### `.message-system`
- **Align Self:** Center
- **Color:** Dim text
- **Font Size:** 12px
- **Text Align:** Center

#### `.streaming-cursor`
- **Display:** Inline-block
- **Size:** 8x16px
- **Background:** Theme primary
- **Animation:** blink 1s infinite

---

### Markdown/Code Rendering

#### `.markdown-content`
- **Line Height:** 1.6

#### `.markdown-content p`
- **Margin:** 0 0 12px 0
- **Last Child:** No bottom margin

#### `.markdown-content pre`
- **Background:** Black at 30% opacity
- **Border:** Theme border on left, right, bottom
- **Border Radius:** 0 0 8px 8px
- **Padding:** 12px
- **Max Height:** 200px
- **Overflow:** Auto

#### `.markdown-content code`
- **Font Family:** SF Mono, Monaco, Cascadia Code
- **Font Size:** 13px
- **Inline Background:** White at 8% opacity
- **Padding:** 2px 6px
- **Border Radius:** 4px

#### `.code-block-wrapper`
- **Position:** Relative
- **Margin:** 12px 0
- **Border Radius:** 8px
- **Overflow:** Hidden

#### `.code-block-header`
- **Display:** Flex with space-between
- **Background:** Theme RGB at 10% opacity
- **Border:** 1px solid theme border
- **Border Radius:** 8px 8px 0 0
- **Padding:** 8px 12px
- **Font:** 12px, weight 500
- **Color:** Theme primary

#### `.copy-code-btn`
- **Display:** Flex with 4px gap
- **Border:** 1px solid theme border
- **Border Radius:** 4px
- **Color:** Theme primary
- **Font Size:** 11px
- **Padding:** 4px 8px
- **Hover:** 10% tint, border glow, box-shadow

#### Syntax Highlighting
- **`.hljs`** - Transparent background override

#### Headings
| Element | Font Size | Margin |
|---------|-----------|--------|
| h1 | 20px | 16px 0 8px |
| h2 | 18px | 16px 0 8px |
| h3 | 16px | 16px 0 8px |
| h4 | 14px | 16px 0 8px |

#### Lists
- **Padding Left:** 20px
- **List Item Margin:** 4px 0

---

### Workspace System

#### `.workspace-sidebar`
- **Background:** Solid black
- **Border Right:** Theme border at 30%
- **Display:** Flex column

#### `.workspace-sidebar-header`
- **Padding:** 12px
- **Border Bottom:** Theme border

#### `.workspace-title`
- **Font Size:** 12px, Weight: 600
- **Text Transform:** Uppercase
- **Letter Spacing:** 0.5px
- **Color:** Theme primary
- **Margin Bottom:** 8px

#### `.workspace-new-btn`
- **Width:** 100%
- **Padding:** 10px 12px
- **Background:** Theme RGB at 5%
- **Border:** 1px solid theme border
- **Color:** Theme primary
- **Hover:** 15% tint, border glow

#### `.workspace-list`
- **Flex:** 1
- **Overflow:** Auto
- **Padding:** 8px

#### `.workspace-item`
- **Display:** Flex with 8px gap
- **Padding:** 10px 0 10px 12px
- **States:**
  - `:hover` - 5% theme tint
  - `.active` - 10% theme tint, 1px border

#### `.workspace-item-text`
- **Flex:** 1
- **Font Size:** 14px
- **Text Overflow:** Ellipsis

#### `.workspace-chat`
- **Background:** Solid black
- **Border Right:** Theme border
- **Display:** Flex column
- **Position:** Relative

#### `.workspace-content`
- **Background:** Solid black
- **Padding:** 24px
- **Overflow:** Auto

#### `.workspace-placeholder`
- **Color:** Dim text
- **Font Size:** 14px
- **Text Align:** Center
- **Margin Top:** 40px

---

### Animation Components

#### `.ribbon-container`
- **Position:** Absolute
- **Placement:** Top 50%, left/right 0
- **Height:** 4px
- **Z-Index:** 100
- **Opacity:** 0 default, 1 when `.visible`
- **States:** `.entering`, `.caught`, `.completing`

#### `.ribbon`
- **Position:** Absolute
- **Size:** Width 100%, height 100%
- **Background:** Linear gradient with theme primary
- **Box Shadow:** Dual glow layers
- **Border Radius:** 2px

#### `.pulse-symbol`
- **Display:** Inline-flex
- **Size:** 20x20px
- **Color:** Theme primary
- **Filter:** Brightness 1.2
- **Vertical Align:** Middle

#### `.pulse-symbol .material-symbols-outlined`
- **Font Size:** 16px
- **Filter:** Drop shadow with theme RGB

#### `.thinking-section`
- **Margin Bottom:** 12px
- **Default:** Opacity 0, translateY(-5px)
- **Visible State:** Opacity 1, translateY(0)
- **Transition:** 200ms ease for both properties

#### `.thinking-header`
- **Font Size:** 11px, Weight: 500
- **Text Transform:** Uppercase
- **Letter Spacing:** 0.5px
- **Color:** Theme primary
- **Display:** Flex with 6px gap
- **Cursor:** Pointer
- **User Select:** None

#### `.thinking-content`
- **Font Style:** Italic
- **Color:** Dim text
- **Opacity:** 0.7
- **Border Left:** 2px solid theme border
- **Padding Left:** 8px

---

## 4. Layout System

### CSS Grid Structure

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (60px)                                                │
├────┬─────────────┬─────────────┬────────────────────────────┤
│    │             │             │                            │
│TOOL│  SIDEBAR    │    CHAT     │        CONTENT             │
│60px│   250px     │   400px     │        1fr (remaining)     │
│    │             │             │                            │
└────┴─────────────┴─────────────┴────────────────────────────┘
```

### Grid Definitions

```css
.app-container {
  grid-template-rows: var(--header-height) 1fr;
  grid-template-columns: 
    var(--tools-width)      /* 60px */
    var(--sidebar-width)    /* 250px */
    var(--chat-width)       /* 400px */
    1fr;                    /* remaining space */
}
```

### Flexbox Patterns

| Pattern | Usage |
|---------|-------|
| `flex-direction: column` | Vertical stacks (panels, sidebars) |
| `align-items: center` | Vertical centering (header items, buttons) |
| `justify-content: space-between` | Header left/right alignment |
| `align-items: flex-end` | Chat input send button alignment |
| `align-self: flex-end` | User messages (right side) |
| `align-self: flex-start` | Assistant messages (left side) |
| `align-self: center` | System messages (center) |

---

## 5. Color System

### Opacity Scale

| Opacity | Usage | Variable Reference |
|---------|-------|-------------------|
| 100% | Solid backgrounds, primary text | `--bg-solid`, `--text-white` |
| 60% | Hover/active borders, glow states | `--border-glow` |
| 30% | Default borders, dividers | `--border-primary`, `--theme-border` |
| 15% | Active button states, user message bubbles | `rgba(var(--theme-primary-rgb), 0.15)` |
| 10% | Code block headers | `rgba(var(--theme-primary-rgb), 0.1)` |
| 8% | Inline code background | `rgba(255, 255, 255, 0.08)` |
| 5% | Glass backgrounds, assistant bubbles | `--glass-bg`, theme RGB at 5% |

### Color Usage Matrix

| Element | Background | Border | Text |
|---------|------------|--------|------|
| Page | `--bg-solid` | Theme border | `--text-white` |
| Header | `--bg-solid` | Theme border | Theme primary (project name) |
| Tool Button | Transparent | Theme border | Theme primary |
| Tool Button Hover | 5% theme tint | 60% glow | Theme primary |
| Tool Button Active | 15% theme tint | 60% glow | Theme primary |
| Sidebar | `--bg-solid` | Primary border | `--text-white` |
| User Message | 15% theme tint | Theme border | `--text-white` |
| Assistant Bubble | 5% theme tint | None | `--text-white` |
| Chat Input | 5% theme tint | Theme border | `--text-white` |
| Send Button | Theme primary | None | `--bg-solid` |
| Code Block Header | 10% theme tint | Theme border | Theme primary |
| Code Block Body | 30% black | Theme border | `--text-white` |

### Visual Effects

| Effect | Implementation |
|--------|---------------|
| Glass Morphism | `rgba(var(--theme-primary-rgb), 0.05)` background |
| Border Glow | `rgba(var(--theme-primary-rgb), 0.6)` border-color |
| Box Shadow Glow | `0 0 8px rgba(var(--theme-primary-rgb), 0.3)` |
| Stronger Glow | `0 0 12px rgba(var(--theme-primary-rgb), 0.5)` |
| Text Glow | `filter: drop-shadow(0 0 4px rgba(var(--theme-primary-rgb), 0.5))` |
| Brightness Boost | `filter: brightness(1.2)` |

---

## 6. Utility Classes

### Scrollbar Styling

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-primary);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-glow);
}
```

### Reset Styles

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

### Hidden State

```css
.hidden {
  display: none;
}
```

### Animation States

| Class | Effect |
|-------|--------|
| `.visible` | Opacity 1 for ribbon/thinking |
| `.entering` | Ribbon enter animation |
| `.caught` | Ribbon pulse animation |
| `.completing` | Ribbon exit animation |
| `.pulsing` | Continuous lens pulse |
| `.pulse-once` | Single pulse cycle |
| `.thinking-shimmer` | Shimmer 1.5s infinite |

### Context Usage States

| Class | Trigger | Visual |
|-------|---------|--------|
| `.high` | Context >= 80% | Orange fill (#f97316) |
| `.critical` | Context >= 95% | Red fill (#ef4444) |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| CSS Variables (:root) | 11 |
| Theme Variables | 4 |
| Keyframe Animations | 7 |
| Component Class Groups | 9 |
| Individual Classes | ~75+ |
| Workspace Color Themes | 7 |
| Animation States | 7 |

---

*Document generated from kimi-ide-server/public/index.html style tag (1037 lines)*
