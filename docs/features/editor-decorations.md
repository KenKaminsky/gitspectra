# ✨ Editor Decorations

**Visual conflict indicators right where you code.**

---

## Overview

GitSpectra provides rich visual feedback directly in your editor, so you never miss a potential conflict. Gutter icons, line highlighting, and overview ruler markers give you instant awareness.

<!-- SCREENSHOT: Editor with various decoration types visible -->
![Editor decorations overview](./images/editor-decorations-overview.png)
*Placeholder: Screenshot showing gutter icons, line highlighting, and ruler markers*

---

## Decoration Types

### Gutter Icons

Small icons in the editor gutter (left margin) indicate line-level conflicts:

<!-- SCREENSHOT: Closeup of gutter with conflict icons -->
![Gutter icons](./images/editor-decorations-gutter.png)
*Placeholder: Closeup of red and yellow gutter icons*

| Icon | Meaning |
|------|---------|
| 🔴 **Red dot** | Hard conflict — this line will cause a merge conflict |
| 🟡 **Yellow dot** | Soft warning — nearby changes in the same file |
| 👤 **Avatar** | Author's Gravatar (when configured) |

### Line Highlighting

Entire lines with conflicts get subtle background highlighting:

<!-- SCREENSHOT: Line highlighting in context -->
![Line highlighting](./images/editor-decorations-highlight.png)
*Placeholder: Screenshot showing background highlighting on conflict lines*

- **Red tint** — Hard conflicts
- **Yellow tint** — Soft warnings
- **Customizable** — Adjust colors in settings

### Overview Ruler

The vertical ruler on the right side of the editor shows conflict positions:

<!-- SCREENSHOT: Overview ruler with markers -->
![Overview ruler markers](./images/editor-decorations-ruler.png)
*Placeholder: Screenshot showing overview ruler with colored markers*

Quickly scroll to conflicts anywhere in the file.

---

## Author Avatars

When enabled, gutter icons show the author's avatar (via Gravatar):

<!-- SCREENSHOT: Avatar in gutter -->
![Author avatar in gutter](./images/editor-decorations-avatar.png)
*Placeholder: Screenshot showing small author avatar as gutter decoration*

At a glance, see *who* made the conflicting change without hovering.

---

## Decoration Persistence

Decorations update automatically when:
- You edit lines (recalculates overlap)
- Remote changes are fetched
- You switch between files
- You dismiss conflicts

---

## Customization

### Colors

```json
{
  "workbench.colorCustomizations": {
    "gitspectra.conflictGutterBackground": "#ff4444",
    "gitspectra.warningGutterBackground": "#ffaa00",
    "gitspectra.conflictLineBackground": "rgba(255, 68, 68, 0.1)",
    "gitspectra.warningLineBackground": "rgba(255, 170, 0, 0.1)"
  }
}
```

### Decoration Settings

```json
{
  "gitspectra.decorations.showGutterIcons": true,
  "gitspectra.decorations.showLineHighlights": true,
  "gitspectra.decorations.showOverviewRuler": true,
  "gitspectra.decorations.showAuthorAvatars": true
}
```

---

## Performance

Decorations are highly optimized:
- Only visible lines are decorated
- Updates are debounced during rapid typing
- Minimal impact on editor performance

---

## Related Features

- [Hover Tooltips](./hover-tooltips.md) — Get details when you hover
- [Conflict Detection](./conflict-detection.md) — How conflicts are found
- [Conflict Radar Panel](./conflict-radar.md) — See all conflicts at once

