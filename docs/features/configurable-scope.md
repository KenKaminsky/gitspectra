# 🎛️ Configurable Scope

**Filter what matters. Ignore the noise.**

---

## Overview

Large codebase? Too many PRs? GitSpectra lets you filter exactly which commits and branches to monitor, so you only see conflicts that matter to you.

<!-- SCREENSHOT: VS Code settings for scope configuration -->
![Scope configuration](./images/scope-settings.png)
*Placeholder: Screenshot of VS Code settings panel with scope options*

---

## Scope Options

### Branch Filtering

Control which branches to check for conflicts:

```json
{
  "gitspectra.scope.branches": [
    "origin/main",
    "origin/develop",
    "origin/release/*"
  ]
}
```

<!-- SCREENSHOT: Branch selection in settings -->
![Branch filtering](./images/scope-branches.png)
*Placeholder: Screenshot showing branch filter configuration*

#### Pattern Matching

- **Exact match**: `origin/main`
- **Wildcard**: `origin/feature/*`
- **Multiple patterns**: `["origin/main", "origin/develop"]`

#### Exclude Branches

```json
{
  "gitspectra.scope.excludeBranches": [
    "origin/dependabot/*",
    "origin/renovate/*",
    "origin/revert-*"
  ]
}
```

Exclude automated branches like Dependabot or Renovate.

---

### Time Window

How far back should GitSpectra look for changes?

```json
{
  "gitspectra.scope.timeWindow": "14d"
}
```

<!-- SCREENSHOT: Time window setting -->
![Time window](./images/scope-timewindow.png)
*Placeholder: Screenshot of time window configuration*

#### Supported Formats

| Format | Meaning |
|--------|---------|
| `7d` | 7 days |
| `2w` | 2 weeks |
| `1m` | 1 month |
| `30d` | 30 days |

#### Recommendations

| Team Size | Suggested Window |
|-----------|-----------------|
| Small (2-5) | `30d` |
| Medium (5-15) | `14d` |
| Large (15+) | `7d` |
| High velocity | `3d` |

---

### Author Filtering

Only check commits from specific people:

```json
{
  "gitspectra.scope.authors": [
    "alice@company.com",
    "bob@company.com"
  ]
}
```

<!-- SCREENSHOT: Author filter configuration -->
![Author filtering](./images/scope-authors.png)
*Placeholder: Screenshot of author filter settings*

#### Use Cases

- **Small team within large org**: Only track your immediate team
- **Specific collaborator**: Watch one person's changes closely
- **Self-only**: Set to your own email to see where you might conflict with yourself

#### Exclude Authors

```json
{
  "gitspectra.scope.excludeAuthors": [
    "bot@ci.com",
    "dependabot[bot]@users.noreply.github.com"
  ]
}
```

Ignore commits from bots and automation.

---

## Configuration Methods

### VS Code Settings

Use the Settings UI or `settings.json`:

```json
{
  "gitspectra.scope.branches": ["origin/main"],
  "gitspectra.scope.timeWindow": "14d",
  "gitspectra.scope.authors": []
}
```

### Team Configuration File

Share settings via `.gitspectra.json`:

```json
{
  "scope": {
    "branches": ["origin/main", "origin/develop"],
    "excludeBranches": ["origin/dependabot/*"],
    "timeWindow": "14d"
  }
}
```

See [Team Configuration](./team-config.md) for details.

---

## Practical Examples

### Frontend Team

```json
{
  "scope": {
    "branches": ["origin/main", "origin/develop"],
    "authors": ["@frontend-team"],
    "timeWindow": "7d"
  }
}
```

### Monorepo with Multiple Teams

```json
{
  "scope": {
    "branches": ["origin/main"],
    "excludeBranches": ["origin/team-*"],
    "timeWindow": "14d"
  }
}
```

### Personal Development

```json
{
  "scope": {
    "branches": ["origin/main"],
    "excludeAuthors": ["dependabot[bot]"],
    "timeWindow": "30d"
  }
}
```

### High-Velocity Project

```json
{
  "scope": {
    "branches": ["origin/main"],
    "timeWindow": "3d",
    "authors": ["alice@company.com", "bob@company.com"]
  }
}
```

---

## Performance Impact

Narrower scope = faster analysis:

| Scope | Performance Impact |
|-------|-------------------|
| All branches, 30 days | Slower |
| Main only, 14 days | Moderate |
| Main only, 7 days, team filter | Fast |

For very large repos, consider aggressive filtering.

---

## Related Features

- [Team Configuration](./team-config.md) — Share scope with your team
- [Conflict Detection](./conflict-detection.md) — How conflicts are found
- [Activity Feed](./activity-feed.md) — Filtered activity view

