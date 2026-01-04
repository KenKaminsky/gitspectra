# 📁 Multi-Repo Workspaces

**Work across multiple repositories seamlessly.**

---

## Overview

GitSpectra supports VS Code workspaces containing multiple Git repositories. When you switch between files in different repos, GitSpectra automatically updates the Conflict Radar and Activity Feed to show the relevant context.

<!-- SCREENSHOT: VS Code with multiple repos in workspace -->
![Multi-repo workspace](./images/multi-repo-workspace.png)
*Placeholder: Screenshot showing VS Code with multiple repos and GitSpectra panels*

---

## How It Works

### Automatic Context Switching

When you open a file:

1. GitSpectra detects which Git repository contains the file
2. The Conflict Radar Panel updates to show conflicts for that repo
3. The Activity Feed refreshes with commits from that repo
4. Editor decorations show conflicts specific to that context

<!-- SCREENSHOT: Panels updating when switching files -->
![Context switching](./images/multi-repo-switch.png)
*Placeholder: Animated GIF or screenshot series showing context switch*

### Repository Detection

GitSpectra walks up the directory tree to find the nearest `.git` folder:

```
~/Projects/
├── frontend/          ← Git repo
│   ├── .git/
│   ├── src/
│   │   └── App.tsx   ← Opens this → shows frontend conflicts
│   └── .gitspectra.json
├── backend/           ← Git repo  
│   ├── .git/
│   ├── api/
│   │   └── users.ts  ← Opens this → shows backend conflicts
│   └── .gitspectra.json
└── shared/            ← Git repo
    └── .git/
```

---

## Workspace Setup

### Method 1: Open Parent Folder

Open a folder containing multiple repos:

```bash
code ~/Projects/
```

GitSpectra will detect repos as you open files within them.

### Method 2: VS Code Multi-Root Workspace

Create a `.code-workspace` file:

```json
{
  "folders": [
    { "path": "frontend" },
    { "path": "backend" },
    { "path": "shared" }
  ],
  "settings": {}
}
```

---

## Per-Repo Configuration

Each repository can have its own `.gitspectra.json`:

```
frontend/.gitspectra.json
{
  "scope": {
    "branches": ["origin/main"],
    "timeWindow": "14d"
  },
  "team": {
    "members": [/* frontend team */]
  }
}

backend/.gitspectra.json
{
  "scope": {
    "branches": ["origin/main", "origin/develop"],
    "timeWindow": "7d"
  },
  "team": {
    "members": [/* backend team */]
  }
}
```

Settings are scoped to each repository.

---

## Panel Behavior

### Conflict Radar Panel

<!-- SCREENSHOT: Conflict Radar showing repo indicator -->
![Conflict Radar repo indicator](./images/multi-repo-radar.png)
*Placeholder: Screenshot of Conflict Radar with current repo shown*

- Shows conflicts for the **active repository** only
- Header indicates which repo is active
- Refresh button updates the current repo

### Activity Feed

<!-- SCREENSHOT: Activity Feed with repo indicator -->
![Activity Feed repo indicator](./images/multi-repo-feed.png)
*Placeholder: Screenshot of Activity Feed with repo context*

- Shows activity for the **active repository** only
- Teammates and commits are scoped to that repo
- Filters are reset when switching repos

### Status Bar

The status bar shows conflict count for the current file's repository:

<!-- SCREENSHOT: Status bar with repo indicator -->
![Status bar](./images/multi-repo-statusbar.png)
*Placeholder: Screenshot of status bar showing "GitSpectra: 2 ⚠️ (frontend)"*

---

## Commands

Commands operate on the repository of the currently active file:

| Command | Scope |
|---------|-------|
| `GitSpectra: Check Now` | Current repo only |
| `GitSpectra: Dismiss All` | Current repo only |
| `GitSpectra: Show Panel` | Opens panel for current repo |

---

## Diff View

When viewing diffs from the Activity Feed:

- Diffs open files from the correct repository
- Relative paths resolve within the repo context
- Multi-file diff shows changes for that repo's commit

---

## Best Practices

### Organize by Project

```
~/Projects/
├── project-alpha/
│   ├── frontend/
│   ├── backend/
│   └── shared/
└── project-beta/
    ├── app/
    └── api/
```

Open at the project level for related repos.

### Consistent Team Config

If repos share a team, consider:
- Symlinking `.gitspectra.json`
- Using a shared base configuration
- Setting workspace-level VS Code settings

### Performance

With many repos:
- GitSpectra only analyzes the active repo
- Switching repos triggers fresh analysis
- Consider shorter time windows for large repos

---

## Troubleshooting

### Wrong Repo Showing

If panels show the wrong repository:
1. Click into a file in the correct repo
2. Wait for panels to refresh
3. Use `GitSpectra: Check Now` to force update

### Panels Not Updating

If panels don't update when switching:
1. Check the status bar for current repo
2. Run `GitSpectra: Check Now`
3. Reload VS Code window if needed

---

## Related Features

- [Team Configuration](./team-config.md) — Per-repo settings
- [Conflict Radar Panel](./conflict-radar.md) — Understanding the panel
- [Activity Feed](./activity-feed.md) — Understanding the feed

