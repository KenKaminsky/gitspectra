# 💬 Rich Hover Tooltips

**All the context you need, right where you need it.**

---

## Overview

Hover over any conflict indicator to see detailed information about who made the change, when, and on which branch—plus quick actions to resolve or explore further.

<!-- SCREENSHOT: Hover tooltip expanded over a conflict line -->
![Hover tooltip overview](./images/hover-tooltip-overview.png)
*Placeholder: Screenshot of expanded hover tooltip*

---

## Tooltip Contents

### Author Information

<!-- SCREENSHOT: Author section of tooltip -->
![Author info in tooltip](./images/hover-tooltip-author.png)
*Placeholder: Screenshot showing avatar, name, and email*

- **Avatar** — Gravatar image
- **Name** — Author's display name
- **Email** — Git commit email

### Commit Details

<!-- SCREENSHOT: Commit section of tooltip -->
![Commit details in tooltip](./images/hover-tooltip-commit.png)
*Placeholder: Screenshot showing commit info*

- **Commit hash** — Short SHA (click to copy)
- **Commit message** — First line of the message
- **Time** — When the commit was made ("2 hours ago")
- **Branch** — Which branch contains this commit

### Conflict Context

- **Line range** — Which lines are affected
- **Conflict type** — Hard conflict or soft warning
- **Your changes** — How your edits relate to theirs

---

## Quick Actions

The tooltip includes action buttons for common operations:

<!-- SCREENSHOT: Quick action buttons in tooltip -->
![Quick actions](./images/hover-tooltip-actions.png)
*Placeholder: Screenshot of action buttons*

| Action | Description |
|--------|-------------|
| **View Diff** | Open side-by-side diff of the conflicting changes |
| **Dismiss** | Mark this conflict as acknowledged |
| **Cherry Pick** | Apply their changes to your branch |
| **Open on GitHub** | View the commit on GitHub |

---

## Multi-Line Conflicts

When a conflict spans multiple lines, hover over any line in the range to see the full context:

<!-- SCREENSHOT: Tooltip for multi-line conflict -->
![Multi-line conflict tooltip](./images/hover-tooltip-multiline.png)
*Placeholder: Screenshot showing "Lines 45-52" in tooltip*

The tooltip shows the complete affected range so you understand the full scope.

---

## Soft Warnings

Soft warnings (yellow indicators) show slightly different information:

<!-- SCREENSHOT: Warning tooltip -->
![Warning tooltip](./images/hover-tooltip-warning.png)
*Placeholder: Screenshot of yellow warning tooltip*

- **Not a guaranteed conflict** — Just a heads-up
- **Nearby changes** — Different lines in the same file
- **Still useful** — Helps you stay aware of team activity

---

## Interactivity

### Keyboard Navigation

- **Esc** — Dismiss the tooltip
- **Tab** — Cycle through action buttons
- **Enter** — Activate focused action

### Link Behavior

- **Commit hash** — Click to copy to clipboard
- **Author email** — Click to filter Activity Feed by this person
- **Branch name** — Click to see all activity on this branch

---

## Configuration

```json
{
  "gitspectra.hover.showAvatar": true,
  "gitspectra.hover.showFullMessage": false,  // Show full commit message
  "gitspectra.hover.delay": 200               // Milliseconds before showing
}
```

---

## Related Features

- [Editor Decorations](./editor-decorations.md) — The visual indicators you hover over
- [Conflict Detection](./conflict-detection.md) — How conflicts are detected
- [Multi-File Diff View](./multi-diff-view.md) — When you click "View Diff"

