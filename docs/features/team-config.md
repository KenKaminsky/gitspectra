# 👥 Team Configuration

**Share settings with your whole team via Git.**

---

## Overview

Commit a `.gitspectra.json` file to your repository so everyone on your team uses the same conflict detection settings. No cloud sync needed—it's just a file in your repo.

<!-- SCREENSHOT: .gitspectra.json file in editor -->
![Team config file](./images/team-config-file.png)
*Placeholder: Screenshot of .gitspectra.json in VS Code*

---

## Quick Start

Create `.gitspectra.json` in your repository root:

```json
{
  "$schema": "https://gitspectra.dev/schema/v1.json",
  "version": "1.0",
  
  "scope": {
    "branches": ["origin/main", "origin/develop"],
    "timeWindow": "14d"
  }
}
```

Commit and push. Your teammates will automatically use these settings.

---

## Configuration Options

### Scope Settings

Control what commits are analyzed:

```json
{
  "scope": {
    "branches": ["origin/main", "origin/develop"],
    "excludeBranches": ["origin/dependabot/*", "origin/renovate/*"],
    "authors": ["alice@company.com", "bob@company.com", "@myteam"],
    "excludeAuthors": ["bot@ci.com"],
    "timeWindow": "14d"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `branches` | `string[]` | Branches to check for conflicts |
| `excludeBranches` | `string[]` | Branch patterns to ignore (supports `*`) |
| `authors` | `string[]` | Only check commits from these authors |
| `excludeAuthors` | `string[]` | Ignore commits from these authors |
| `timeWindow` | `string` | How far back to look (`7d`, `2w`, `1m`) |

### Team Members

Define your team for better UX:

```json
{
  "team": {
    "members": [
      { 
        "name": "Alice Chen", 
        "email": "alice@company.com",
        "github": "alicechen"
      },
      { 
        "name": "Bob Smith", 
        "email": "bob@company.com",
        "github": "bobsmith"
      }
    ]
  }
}
```

Team members show friendly names in the Activity Feed and tooltips.

### Display Settings

Customize the UI:

```json
{
  "display": {
    "showWarnings": true,
    "showAvatars": true,
    "groupByFolder": true
  }
}
```

---

## Full Example

```json
{
  "$schema": "https://gitspectra.dev/schema/v1.json",
  "version": "1.0",
  
  "scope": {
    "branches": [
      "origin/main",
      "origin/develop",
      "origin/release/*"
    ],
    "excludeBranches": [
      "origin/dependabot/*",
      "origin/renovate/*"
    ],
    "timeWindow": "14d"
  },
  
  "team": {
    "members": [
      { "name": "Alice Chen", "email": "alice@company.com" },
      { "name": "Bob Smith", "email": "bob@company.com" },
      { "name": "Carol Jones", "email": "carol@company.com" }
    ]
  },
  
  "display": {
    "showWarnings": true,
    "showAvatars": true
  }
}
```

---

## Priority Order

GitSpectra merges settings from multiple sources:

1. **Workspace `.gitspectra.json`** (highest priority)
2. **User VS Code settings**
3. **Default values** (lowest priority)

Team configuration overrides individual settings, ensuring consistency.

---

## Schema Validation

Use the JSON schema for autocomplete and validation:

<!-- SCREENSHOT: Schema autocomplete in VS Code -->
![Schema autocomplete](./images/team-config-schema.png)
*Placeholder: Screenshot showing autocomplete from schema*

The schema provides:
- Property autocomplete
- Value validation
- Inline documentation
- Error highlighting

---

## Best Practices

### Do Commit

- ✅ Branch scope settings
- ✅ Time window configuration
- ✅ Team member definitions
- ✅ Exclude patterns for bots

### Don't Commit

- ❌ User-specific preferences
- ❌ Local path configurations
- ❌ Personal author filters

### Version Control

Consider your `.gitspectra.json` as code:
- Review changes in PRs
- Document significant changes
- Keep settings minimal

---

## Migrating Settings

If you have VS Code settings you want to share:

1. Create `.gitspectra.json` with equivalent settings
2. Remove user-level VS Code settings (optional)
3. Commit and share with team

---

## Related Features

- [Configurable Scope](./configurable-scope.md) — Detailed scope options
- [Enterprise Ready](./enterprise.md) — Deployment for teams
- [Multi-Repo Workspaces](./multi-repo.md) — Multiple repos with different configs

