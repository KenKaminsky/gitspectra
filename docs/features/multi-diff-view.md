# 🔍 Multi-File Diff View

**View commit changes like a pull request—all files in one scrollable view.**

---

## Overview

When you want to see all changes from a commit, GitSpectra opens VS Code's native multi-file diff editor. This gives you a PR-like experience: scroll through all changed files in a single, unified view.

<!-- SCREENSHOT: Multi-diff editor showing multiple files -->
![Multi-diff view overview](./images/multi-diff-overview.png)
*Placeholder: Screenshot of VS Code multi-diff editor with multiple files*

---

## How to Open

### From Activity Feed

Click the **"View Full Diff in VS Code"** button on any commit:

<!-- SCREENSHOT: Button in Activity Feed -->
![View Full Diff button](./images/multi-diff-button.png)
*Placeholder: Screenshot of the button in Activity Feed*

### From Commit Details

When viewing expanded commit details, click the diff button:

<!-- SCREENSHOT: Diff button in expanded commit -->
![Diff button in commit details](./images/multi-diff-commit-action.png)
*Placeholder: Screenshot of action button in expanded commit*

---

## Features

### Scrollable Unified View

All file diffs appear in one continuous, scrollable pane:

<!-- SCREENSHOT: Scrolling through multiple files -->
![Scrollable diff view](./images/multi-diff-scroll.png)
*Placeholder: Screenshot showing scrollable view with file headers*

- Each file has a header with the filename
- Scroll smoothly between files
- No tab switching needed

### Collapse & Expand

Click on any file header to collapse or expand that file's diff:

<!-- SCREENSHOT: Collapsed and expanded file sections -->
![Collapse and expand files](./images/multi-diff-collapse.png)
*Placeholder: Screenshot showing collapsed/expanded file sections*

Focus on the files that matter most.

### Full Syntax Highlighting

Diffs use VS Code's native syntax highlighting for your language:

<!-- SCREENSHOT: Syntax highlighted diff -->
![Syntax highlighting](./images/multi-diff-syntax.png)
*Placeholder: Screenshot showing syntax-highlighted code in diff*

### Navigation

Use keyboard shortcuts to navigate:

| Shortcut | Action |
|----------|--------|
| **F7** | Go to next change |
| **Shift+F7** | Go to previous change |
| **Ctrl/Cmd+Down** | Next file |
| **Ctrl/Cmd+Up** | Previous file |

---

## Individual File Diffs

For a single file, GitSpectra opens a standard VS Code diff tab:

<!-- SCREENSHOT: Single file diff view -->
![Single file diff](./images/multi-diff-single.png)
*Placeholder: Screenshot of standard vscode.diff view*

Click any file in the Activity Feed's file list to see just that file's changes.

---

## Comparing Versions

GitSpectra compares:

| Left Side | Right Side |
|-----------|------------|
| **Parent commit** (`commit^`) | **The commit** (`commit`) |

This shows exactly what changed in that specific commit.

---

## Requirements

The multi-file diff view requires:

- **VS Code 1.86+** (January 2024 or later)
- No additional extensions needed—this is native VS Code functionality

### Fallback for Older Versions

If you're on an older VS Code version, GitSpectra falls back to:
1. Showing a file picker
2. Opening individual file diffs

---

## Technical Details

GitSpectra uses VS Code's native `_workbench.openMultiDiffEditor` command with:
- Git scheme URIs (`git:`) for file content at specific refs
- Automatic parent commit detection
- Proper handling of added, modified, and deleted files

No external extensions required—works entirely with VS Code's built-in capabilities.

---

## Related Features

- [Activity Feed](./activity-feed.md) — Where you access the diff view
- [Conflict Radar Panel](./conflict-radar.md) — Navigate to conflicting files
- [Editor Decorations](./editor-decorations.md) — See conflicts inline

