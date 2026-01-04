# 📰 Activity Feed

**Stay informed about what your team is doing.**

---

## Overview

The Activity Feed is a rich, real-time view of your team's Git activity. See who's committing what, identify hot files, and catch potential overlaps before they become conflicts.

<!-- SCREENSHOT: Activity Feed panel showing recent commits -->
![Activity Feed overview](./images/activity-feed-overview.png)
*Placeholder: Screenshot of the Activity Feed panel*

---

## View Modes

### 📅 Timeline View

See all recent activity in chronological order. Each commit shows:
- Author avatar and name
- Commit message (expandable for full details)
- Branch name
- Time ago
- Files changed with addition/deletion stats

<!-- SCREENSHOT: Timeline view with commits -->
![Timeline view](./images/activity-feed-timeline.png)
*Placeholder: Screenshot of Timeline view with commit cards*

### 👤 By Person View

Group activity by team member to see who's working on what. Quickly identify what specific teammates have been changing.

<!-- SCREENSHOT: By Person view showing grouped commits -->
![By Person view](./images/activity-feed-by-person.png)
*Placeholder: Screenshot of By Person view*

### 🔥 Hot Files View

Identify files with high activity—multiple people editing the same files. These are your highest-risk areas for conflicts.

<!-- SCREENSHOT: Hot Files view showing file activity -->
![Hot Files view](./images/activity-feed-hot-files.png)
*Placeholder: Screenshot of Hot Files view*

---

## Commit Details

Click "Show more" on any commit to expand full details:

<!-- SCREENSHOT: Expanded commit showing file list and stats -->
![Expanded commit details](./images/activity-feed-commit-details.png)
*Placeholder: Screenshot of expanded commit with file list*

### What You'll See

- **Full commit message** — Including multi-line descriptions, formatted with markdown
- **File tree** — All changed files organized by directory
- **Line statistics** — Additions (+) and deletions (-) per file
- **Overlap indicators** — Highlighted when you've also touched these files

### Quick Actions

- **View Full Diff in VS Code** — Opens the PR-like multi-file diff view
- **Open on GitHub** — Jump to the commit on GitHub
- **Open File** — Navigate directly to any changed file
- **View File Diff** — See what changed in a specific file

---

## File Statistics

Every commit and file shows change statistics:

<!-- SCREENSHOT: File stats showing +/- indicators -->
![File statistics](./images/activity-feed-stats.png)
*Placeholder: Screenshot showing +42 -15 style statistics*

| Indicator | Meaning |
|-----------|---------|
| **+42** (green) | Lines added |
| **-15** (red) | Lines deleted |
| **⚠️ Overlap** | You've also modified this file |

---

## Filtering

Filter the feed to focus on what matters:

<!-- SCREENSHOT: Filter controls in header -->
![Activity Feed filters](./images/activity-feed-filters.png)
*Placeholder: Screenshot of filter dropdown/controls*

- **By Author** — Show only specific teammates
- **By Branch** — Focus on main, develop, or feature branches
- **Clear Filters** — Reset to show all activity

---

## Real-Time Updates

The Activity Feed stays current:

- **Auto-refresh** — Updates after each `git fetch`
- **Manual refresh** — Click the refresh button
- **New activity indicators** — See when new commits arrive

---

## Configuration

```json
{
  "gitspectra.activityFeed.maxCommits": 50,    // How many commits to show
  "gitspectra.activityFeed.showBranches": true, // Include branch names
  "gitspectra.activityFeed.fileViewMode": "tree" // "tree" or "list"
}
```

---

## Related Features

- [Hot Files View](./hot-files.md) — Deep dive into high-activity files
- [Multi-File Diff View](./multi-diff-view.md) — View commit changes PR-style
- [Conflict Radar Panel](./conflict-radar.md) — See current conflicts

