# Google Font Icons vs Google Material Symbols

A comprehensive comparison of Google's two icon font systems.

---

## Summary

| | **Material Icons** | **Material Symbols** |
|---|---|---|
| **What it is** | The original icon font | The newer, variable font version |
| **Launch** | ~2014 | ~2021 (newer replacement) |
| **Icons count** | ~900+ | ~2,500+ |
| **Font type** | Static font files | Variable font (single file) |
| **Customization** | Limited (size, color) | Extensive (weight, fill, optical size, grade) |

---

## Key Differences

### 1. Variable Font Capabilities

**Material Symbols** is a variable font, meaning you can adjust multiple axes of variation with CSS:

```css
/* Material Symbols - highly customizable */
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,      /* 0 or 1 (outlined vs filled) */
    'wght' 400,    /* 100-700 (weight/thickness) */
    'GRAD' 0,      /* -25 to 200 (grade/emphasis) */
    'opsz' 24;     /* 20-48 (optical size) */
}
```

**Material Icons** only has static styles (Outlined, Rounded, Sharp, Two-tone, Filled) loaded as separate font files.

### 2. Icon Count

- **Material Icons**: ~900 icons
- **Material Symbols**: 2,500+ icons (more comprehensive set)

### 3. Usage

#### Material Icons (legacy)

```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<span class="material-icons">home</span>
```

#### Material Symbols (recommended)

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
<span class="material-symbols-outlined">home</span>
```

### 4. Style Variants

| Style | Material Icons | Material Symbols |
|-------|---------------|------------------|
| Outlined | ✅ | ✅ |
| Rounded | ✅ | ✅ |
| Sharp | ✅ | ✅ |
| Two-tone | ✅ | ❌ |
| Filled | ✅ | ✅ (via `FILL` axis) |

---

## Variable Font Axes (Material Symbols Only)

| Axis | Range | Description |
|------|-------|-------------|
| `FILL` | 0 - 1 | Toggles between outlined (0) and filled (1) |
| `wght` | 100 - 700 | Controls stroke weight/thickness |
| `GRAD` | -25 - 200 | Adjusts emphasis without changing weight |
| `opsz` | 20 - 48 | Optical size for better legibility at different sizes |

### Example: Customizing Material Symbols

```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">

<style>
  /* Thin, outlined icon */
  .icon-thin {
    font-variation-settings: 'FILL' 0, 'wght' 100, 'GRAD' 0, 'opsz' 24;
  }

  /* Bold, filled icon */
  .icon-bold {
    font-variation-settings: 'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24;
  }
</style>

<span class="material-symbols-outlined icon-thin">favorite</span>
<span class="material-symbols-outlined icon-bold">favorite</span>
```

---

## Which Should You Use?

### Use Material Symbols if:

- You're starting a new project
- You need the latest icons (2,500+ available)
- You want fine-grained control over weight, fill, and optical size
- You want a single font file instead of multiple style files
- You want to match icon weight with your typography

### Use Material Icons if:

- You're maintaining legacy code that already uses it
- You specifically need the Two-tone style (not available in Symbols)
- You need maximum browser compatibility (older browsers may not support variable fonts)
- You're using older Angular Material versions (pre-v15)

---

## Google's Recommendation

Google treats **Material Symbols** as the successor to Material Icons. The Google Fonts website defaults to showing Material Symbols, and it's the recommended choice for new projects.

> Material Symbols are our newest icons consolidating over 2,500 glyphs in a single font file with a wide range of design variants.
> — Google Fonts Team

---

## Additional Resources

- [Material Symbols on Google Fonts](https://fonts.google.com/icons)
- [Material Icons GitHub Repository](https://github.com/google/material-design-icons)
- [Variable Fonts Guide](https://developers.google.com/fonts/docs/material_symbols)
- [Figma Plugin for Material Symbols](https://www.figma.com/community/plugin/1088610476491668236)

---

*Last updated: March 2026*
