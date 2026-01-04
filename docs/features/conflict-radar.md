# 📊 Conflict Radar Panel

**Your command center for conflict visibility.**

---

## Overview

The Conflict Radar Panel is a dedicated sidebar view that shows all detected conflicts across your workspace. At a glance, see which files have conflicts, their severity, and who made the conflicting changes.

<!-- SCREENSHOT: Full conflict radar panel with multiple files listed -->
![Conflict Radar Panel overview](./images/conflict-radar-panel.png)
*Placeholder: Screenshot of the Conflict Radar Panel in the sidebar*

---

## Panel Structure

The Conflict Radar organizes information hierarchically:

```
📊 Conflict Radar
├── 📁 src/
│   ├── 🔴 auth/login.ts (3 conflicts)
│   │   ├── Line 45-52 — Sarah Chen (2h ago)
│   │   ├── Line 78 — Marcus Johnson (yesterday)
│   │   └── Line 112-115 — Sarah Chen (2h ago)
│   └── 🟡 api/users.ts (1 warning)
│       └── Line 23 — Alex Rivera (4h ago)
└── 📁 tests/
    └── 🟡 auth.test.ts (2 warnings)
```

<!-- SCREENSHOT: Expanded tree view showing files and conflict details -->
![Conflict Radar tree structure](./images/conflict-radar-tree.png)
*Placeholder: Screenshot showing expanded tree with conflict details*

---

## Features

### Severity Badges

Each file shows a badge indicating conflict severity:

| Badge | Meaning |
|-------|---------|
| 🔴 **Red** | Hard conflicts — will fail to merge |
| 🟡 **Yellow** | Soft warnings — same file, different lines |
| ✅ **Clear** | No conflicts detected |

### Quick Actions

Right-click any item for quick actions:

<!-- SCREENSHOT: Context menu with actions -->
![Conflict Radar context menu](./images/conflict-radar-actions.png)
*Placeholder: Screenshot of right-click context menu*

- **Open File** — Jump to the file in the editor
- **View Diff** — See the conflicting changes side-by-side
- **Dismiss** — Acknowledge and hide this conflict
- **Cherry Pick** — Apply the remote changes to your branch

### File Explorer Integration

Files with conflicts also show badges in VS Code's file explorer:

<!-- SCREENSHOT: File explorer showing conflict badges -->
![File explorer badges](./images/conflict-radar-explorer.png)
*Placeholder: Screenshot of file explorer with conflict badges*

---

## Filtering & Sorting

Use the panel header controls to filter what you see:

<!-- SCREENSHOT: Panel header with filter controls -->
![Conflict Radar filters](./images/conflict-radar-filters.png)
*Placeholder: Screenshot of filter/sort controls in panel header*

- **By Severity** — Show only hard conflicts or include warnings
- **By Author** — Focus on specific teammates
- **By Date** — Most recent or oldest first

---

## Refresh & Sync

The panel updates automatically when:
- Auto-fetch runs (configurable interval)
- You save a file (if `fetchOnSave` is enabled)
- You run `GitSpectra: Check Now`

Manual refresh available via the refresh button in the panel header.

---

## Configuration

```json
{
  "gitspectra.panel.showWarnings": true,     // Include soft warnings
  "gitspectra.panel.groupByFolder": true,    // Group files by directory
  "gitspectra.panel.autoExpand": false       // Auto-expand items on refresh
}
```

---

## Related Features

- [Real-Time Conflict Detection](./conflict-detection.md) — How conflicts are detected
- [Editor Decorations](./editor-decorations.md) — See conflicts inline in your code
- [Activity Feed](./activity-feed.md) — Track team activity over time

