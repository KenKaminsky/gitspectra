# 🎯 Real-Time Conflict Detection

**See conflicts as you type—not when you try to merge.**

---

## The Problem

You're deep in flow, coding a critical feature. Two hours later, you push—only to discover your teammate already changed the same lines you did. The merge fails. Now you have to understand their changes, figure out how they interact with yours, and manually resolve conflicts.

**This is preventable.**

## The Solution

GitSpectra warns you **before you commit** that someone else has changed lines you're working on.

<!-- SCREENSHOT: Editor showing red gutter icons on conflicting lines -->
![Real-time conflict detection in the editor](./images/conflict-detection-editor.png)
*Placeholder: Screenshot showing red conflict indicators in the gutter while editing*

---

## How It Works

GitSpectra uses `git merge-tree` to simulate merges locally, detecting conflicts without touching your working directory:

1. **Background Fetch** — Periodically runs `git fetch` to get the latest remote state
2. **Merge Simulation** — Uses `git merge-tree` to simulate merging remote changes with your local work
3. **Conflict Parsing** — Parses output to find exact conflicting line ranges
4. **UI Update** — Decorates your editor with conflict indicators in real-time

```
┌─────────────────────────────────────┐
│          GitSpectra Engine          │
├─────────────────────────────────────┤
│                                     │
│   git fetch origin                  │
│           ↓                         │
│   git merge-tree base target HEAD   │
│           ↓                         │
│   Parse conflict markers            │
│           ↓                         │
│   Update VS Code decorations        │
│                                     │
└─────────────────────────────────────┘
```

---

## Conflict Types

### 🔴 Hard Conflicts
Lines that will definitely cause a merge conflict. Both you and a teammate modified the exact same lines.

<!-- SCREENSHOT: Red gutter icon closeup -->
![Hard conflict indicator](./images/conflict-hard.png)
*Placeholder: Closeup of red conflict gutter icon*

### 🟡 Soft Warnings
Lines where you and a teammate touched the same file in nearby regions. Not a guaranteed conflict, but worth knowing about.

<!-- SCREENSHOT: Yellow gutter icon closeup -->
![Soft warning indicator](./images/conflict-soft.png)
*Placeholder: Closeup of yellow warning gutter icon*

---

## Key Benefits

| Benefit | Description |
|---------|-------------|
| ⚡ **Instant Feedback** | See conflicts as you type, not after you push |
| 🎯 **Line-Level Precision** | Know exactly which lines are affected |
| 👤 **Author Attribution** | See who made the conflicting change |
| 🔄 **Auto-Updates** | Stays current as teammates push changes |
| 🔒 **100% Local** | No data leaves your machine |

---

## Configuration

Control conflict detection through VS Code settings:

```json
{
  "gitspectra.fetchInterval": 300,        // Seconds between auto-fetch (0 = disabled)
  "gitspectra.fetchOnSave": true,         // Fetch when you save a file
  "gitspectra.scope.branches": ["origin/main"],  // Branches to check against
  "gitspectra.scope.timeWindow": "30d"    // How far back to look
}
```

---

## Related Features

- [Conflict Radar Panel](./conflict-radar.md) — See all conflicts in one place
- [Editor Decorations](./editor-decorations.md) — Visual indicators in your code
- [Hover Tooltips](./hover-tooltips.md) — Get details on any conflict

