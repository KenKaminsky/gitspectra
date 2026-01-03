# GitSpectra - Product Requirements Document

> **Local-Only Async Conflict Detection for VS Code**
>
> Version: 1.0 Draft
> Last Updated: January 2, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Target Users](#4-target-users)
5. [Core Features](#5-core-features)
6. [Technical Architecture](#6-technical-architecture)
7. [Configuration System](#7-configuration-system)
8. [User Interface](#8-user-interface)
9. [User Stories](#9-user-stories)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Competitive Analysis](#11-competitive-analysis)
12. [Roadmap](#12-roadmap)
13. [Success Metrics](#13-success-metrics)

---

## 1. Executive Summary

### Mission

**Eliminate "blind coding" by alerting developers to pending conflicts in real-time, using 100% local Git operations to ensure maximum privacy and enterprise security.**

### The Elevator Pitch

> "GitSpectra is like having a teammate watching your back. It tells you—before you commit—that someone else on your team has already changed the lines you're working on. No cloud. No tracking. Just Git."

### Key Differentiators

| Feature            | Cloud Tools | CodeStream | **GitSpectra** |
| ------------------ | ------- | ---------- | ----------------- |
| Cloud-free         | ❌      | ❌         | ✅                |
| P2P/Real-time sync | ✅      | ❌         | ❌ (by design)    |
| Works offline      | ❌      | ❌         | ✅                |
| Enterprise-ready   | ⚠️      | ⚠️         | ✅                |
| Configurable scope | ❌      | ❌         | ✅                |
| Team config file   | ❌      | ❌         | ✅                |
| Open source        | ❌      | ❌         | ✅                |

---

## 2. Problem Statement

### The Pain

Developers currently operate in a **"conflict fog"**:

1. **Discovery is too late**: Conflicts are only discovered at merge time, often after hours of work.
2. **Manual checking is tedious**: Running `git fetch` and checking PRs manually interrupts flow.
3. **Team coordination is poor**: No visibility into what teammates are actively changing.
4. **Large codebases are chaos**: Hundreds of outstanding PRs make it impossible to track relevant changes.

### The Cost

- **Wasted developer hours**: Resolving conflicts that could have been avoided.
- **Merge anxiety**: Fear of merging leads to longer-lived branches and bigger conflicts.
- **Context switching**: Discovering conflicts late requires re-understanding code.

### Why Existing Solutions Fail

- **Cloud-based tools**: Require cloud connectivity and P2P sync—blocked by many enterprise security policies.
- **CodeStream**: Focused on code review, not conflict prevention.
- **Manual git fetch**: Requires discipline and doesn't provide visual feedback.

---

## 3. Solution Overview

### What GitSpectra Does

1. **Background Monitoring**: Silently fetches and analyzes remote branches at configurable intervals.
2. **Conflict Detection**: Uses `git merge-tree` to detect conflicts _without_ modifying working directory.
3. **Scoped Analysis**: Filters by team members, time windows, or specific branches.
4. **Visual Alerts**: Shows conflict indicators in the editor gutter, per-line.
5. **Team Configuration**: Shareable config file that the team can commit to the repo.

### What GitSpectra Does NOT Do

- ❌ Send any data to external servers
- ❌ Real-time P2P synchronization
- ❌ Require user accounts or authentication (beyond existing Git credentials)
- ❌ Modify Git state (no commits, no merges)
- ❌ Access files outside the repository

---

## 4. Target Users

### Primary Personas

#### 🏦 The Enterprise Developer

- Works in regulated industries (banking, healthcare, defense)
- Cannot install cloud-connected extensions
- Needs IT approval for all tools
- Values: **Security, compliance, auditability**

#### 🚀 The High-Velocity Team Member

- Works on active repos with many contributors
- Multiple PRs open at any time
- Needs to know if their changes will conflict
- Values: **Speed, efficiency, fewer surprises**

#### 🔧 The Open Source Maintainer

- Manages repos with external contributors
- Needs to coordinate with unknown contributors
- Values: **Visibility, control, async workflow**

### Secondary Personas

#### 👥 The Tech Lead

- Needs team-wide conflict visibility
- Wants to configure scopes for the team
- Values: **Consistency, shared configuration**

#### 🆕 The Junior Developer

- Often works on files that others touch
- Afraid of breaking things
- Values: **Early warnings, guidance**

---

## 5. Core Features

### 5.1 Background Fetch & Sync

**Requirement ID**: F-001

**Description**: Automatically fetch remote branches at configurable intervals.

**Behavior**:

- Run `git fetch origin` (or configured remotes) in background
- Configurable triggers:
  - Interval-based (every N minutes)
  - On file save
  - On file focus
  - Manual trigger
- Respect `.gitignore` and don't fetch during heavy operations

**Configuration**:

```json
{
  "fetchInterval": 300, // seconds (0 = disabled)
  "fetchOnSave": true,
  "fetchOnFocus": false,
  "remotes": ["origin"]
}
```

---

### 5.2 Conflict Detection Engine

**Requirement ID**: F-002

**Description**: Detect potential conflicts using `git merge-tree` without modifying working directory.

**Behavior**:

1. Identify target branches to check against (from config)
2. Run `git merge-tree <merge-base> <target> <current>` for each target
3. Parse output for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
4. Map conflict line numbers to current file lines
5. Cache results until next fetch or file change

**Key Algorithm**:

```
For each file in working directory:
  For each configured target branch:
    base = merge-base(current-branch, target)
    result = git merge-tree(base, target, current)
    if result contains conflict markers:
      extract line ranges
      mark as CONFLICT (red)
    else if result shows changes near current edits:
      mark as WARNING (yellow)
```

---

### 5.3 Scope Filtering

**Requirement ID**: F-003

**Description**: Allow users to filter which commits/PRs to track.

**Filter Types**:

| Filter            | Description                            | Example                            |
| ----------------- | -------------------------------------- | ---------------------------------- |
| `authors`         | Only track commits by specific authors | `["alice@company.com", "bob"]`     |
| `timeWindow`      | Only track commits within time range   | `"7d"` (last 7 days)               |
| `branches`        | Specific branches to check             | `["main", "develop", "release/*"]` |
| `excludeBranches` | Branches to ignore                     | `["feature/legacy-*"]`             |
| `files`           | Only check specific file patterns      | `["src/**/*.ts"]`                  |
| `excludeFiles`    | Ignore file patterns                   | `["*.test.ts", "*.md"]`            |

**Configuration Example**:

```json
{
  "scope": {
    "authors": ["@team"], // Special keyword for team list
    "timeWindow": "14d",
    "branches": ["origin/main", "origin/develop"],
    "excludeBranches": ["origin/dependabot/*"]
  }
}
```

---

### 5.4 Team Configuration File

**Requirement ID**: F-004

**Description**: Shareable configuration file committed to the repository.

**File**: `.gitspectra.json` (or `gitspectra.config.json`)

**Location**: Repository root

**Behavior**:

- Team-wide defaults that apply to all contributors
- User can override with VS Code settings
- Supports inheritance and extends

**Full Schema**:

```json
{
  "$schema": "https://gitspectra.dev/schema/v1.json",
  "version": "1.0",

  "fetch": {
    "interval": 300,
    "onSave": true,
    "onFocus": false,
    "remotes": ["origin"]
  },

  "scope": {
    "authors": ["alice", "bob", "charlie"],
    "timeWindow": "14d",
    "branches": ["origin/main", "origin/develop"],
    "excludeBranches": ["origin/dependabot/*", "origin/renovate/*"]
  },

  "team": {
    "members": [
      { "name": "Alice", "email": "alice@company.com", "github": "alice" },
      { "name": "Bob", "email": "bob@company.com", "github": "bobdev" }
    ]
  },

  "ui": {
    "showInGutter": true,
    "showInStatusBar": true,
    "conflictColor": "#ef4444",
    "warningColor": "#f59e0b"
  },

  "notifications": {
    "onConflictDetected": true,
    "onNewCommitFromTeam": false,
    "debounceMs": 5000
  }
}
```

---

### 5.5 Visual Conflict Indicators

**Requirement ID**: F-005

**Description**: Display conflict information in the editor.

**Gutter Icons**:

| Icon | Color  | Meaning                                                               |
| ---- | ------ | --------------------------------------------------------------------- |
| 🔴   | Red    | **Hard conflict**: Remote branch changed lines you've also changed    |
| 🟡   | Yellow | **Soft warning**: Remote branch changed nearby lines (within N lines) |
| 🟢   | Green  | **Resolved**: You've marked this conflict as acknowledged             |
| 🔵   | Blue   | **Info**: Teammate is working on this file (optional)                 |

**Hover Information**:
When hovering over a conflict indicator, show:

- Which branch(es) caused the conflict
- Who made the commit (author name + avatar if available)
- When it was pushed (relative time)
- Commit message (first line)
- Quick actions: "View Diff", "Open PR", "Dismiss"

**Status Bar**:

- Show overall conflict count: `⚠️ 3 conflicts`
- Click to open Conflict Panel

---

### 5.6 Conflict Panel

**Requirement ID**: F-006

**Description**: A dedicated panel showing all detected conflicts.

**Location**: Activity Bar (sidebar) or Panel (bottom)

**Content**:

```
CONFLICTGUARD
─────────────────────────────────

📁 Files with Conflicts (3)

  🔴 src/components/Button.tsx
     ├─ Lines 45-52: Conflicts with origin/main
     │   └─ Bob (2 hours ago): "Refactored button styles"
     └─ Lines 120-125: Conflicts with origin/feature-auth
         └─ Alice (yesterday): "Added loading state"

  🟡 src/utils/api.ts
     └─ Lines 30-35: Warning - nearby changes
         └─ Charlie (3 days ago): "Updated error handling"

─────────────────────────────────

📊 Summary
  • 2 hard conflicts
  • 1 soft warning
  • Last fetch: 2 minutes ago
  • Tracking: origin/main, origin/develop

─────────────────────────────────

⚙️ Quick Actions
  [Fetch Now]  [Configure]  [Dismiss All]
```

---

### 5.7 Diff View Integration

**Requirement ID**: F-007

**Description**: Show side-by-side or inline diff of conflicting changes.

**Behavior**:

- Click "View Diff" from hover or panel
- Opens VS Code diff view
- Shows: Your Version ↔ Remote Version
- Highlights specific conflicting lines

---

## 6. Technical Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Watcher   │  │  Git Driver │  │       Analyzer          │ │
│  │             │──│             │──│                         │ │
│  │ - File save │  │ - fetch     │  │ - merge-tree parsing    │ │
│  │ - Focus     │  │ - log       │  │ - line mapping          │ │
│  │ - Interval  │  │ - merge-tree│  │ - conflict detection    │ │
│  └─────────────┘  │ - diff      │  └───────────┬─────────────┘ │
│                   └─────────────┘              │               │
│                                                │               │
│  ┌─────────────────────────────────────────────▼─────────────┐ │
│  │                      State Manager                        │ │
│  │  - Conflict cache                                         │ │
│  │  - Configuration                                          │ │
│  │  - Team data                                              │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                 │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │                        UI Layer                           │ │
│  │  ┌────────────┐  ┌─────────────┐  ┌───────────────────┐  │ │
│  │  │   Gutter   │  │  Status Bar │  │   Conflict Panel  │  │ │
│  │  │ Decorations│  │   Provider  │  │    (WebView)      │  │ │
│  │  └────────────┘  └─────────────┘  └───────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ child_process
                              ▼
                    ┌─────────────────┐
                    │   Local Git CLI │
                    │   (git binary)  │
                    └─────────────────┘
```

### 6.2 Component Details

#### Git Driver

Lightweight wrapper around the local Git CLI using `child_process`.

```typescript
interface GitDriver {
  // Core operations
  fetch(remote?: string): Promise<void>;
  mergeTree(base: string, target: string): Promise<MergeTreeResult>;
  log(options: LogOptions): Promise<Commit[]>;
  diff(ref1: string, ref2: string, file?: string): Promise<DiffResult>;

  // Helpers
  getCurrentBranch(): Promise<string>;
  getMergeBase(branch1: string, branch2: string): Promise<string>;
  getRemoteBranches(): Promise<string[]>;
}
```

**Key Decision**: Use direct `child_process` instead of `simple-git` to:

- Minimize bundle size
- Reduce dependency risks
- Full control over parsing

#### Analyzer

Parses `git merge-tree` output and maps conflicts to line numbers.

```typescript
interface ConflictAnalyzer {
  analyzeFile(
    filePath: string,
    targetBranches: string[]
  ): Promise<FileConflictReport>;

  parseConflictMarkers(mergeTreeOutput: string): ConflictHunk[];

  mapToCurrentLines(
    hunks: ConflictHunk[],
    currentContent: string
  ): MappedConflict[];
}

interface FileConflictReport {
  file: string;
  conflicts: ConflictInfo[];
  warnings: WarningInfo[];
  lastAnalyzed: Date;
}

interface ConflictInfo {
  lines: LineRange;
  type: "hard" | "soft";
  source: {
    branch: string;
    commit: string;
    author: string;
    date: Date;
    message: string;
  };
}
```

#### State Manager

Manages caching and configuration.

```typescript
interface StateManager {
  // Conflict cache
  getConflicts(file: string): ConflictInfo[];
  setConflicts(file: string, conflicts: ConflictInfo[]): void;
  invalidateFile(file: string): void;
  invalidateAll(): void;

  // Configuration
  getConfig(): GitSpectraConfig;
  getTeamMembers(): TeamMember[];

  // Persistence
  saveState(): Promise<void>;
  loadState(): Promise<void>;
}
```

### 6.3 Key Technical Challenges

#### Challenge 1: Line Number Mapping

**Problem**: `git merge-tree` outputs conflict markers for the _merged_ result, not the current file.

**Solution**: Use a two-phase approach:

1. Parse conflict markers from merge-tree output
2. Use fuzzy matching (e.g., difflib) to map hunks to current file lines

#### Challenge 2: Performance with Many Branches

**Problem**: Checking against 50+ branches would be slow.

**Solution**:

- Apply scope filters before analysis
- Parallel execution with concurrency limit
- Cache merge-base calculations
- Skip unchanged files (use file hash)

#### Challenge 3: Git Credential Passthrough

**Problem**: `git fetch` may require authentication.

**Solution**:

- Use existing Git credential helpers configured by user
- Rely on SSH agent or credential manager
- Never store or request credentials directly

---

## 7. Configuration System

### 7.1 Configuration Priority

1. **Workspace settings** (`.vscode/settings.json`) - highest priority
2. **Project config** (`.gitspectra.json`) - shared with team
3. **User settings** (VS Code user settings) - personal defaults
4. **Extension defaults** - fallback

### 7.2 VS Code Settings

```json
{
  "gitspectra.enabled": true,
  "gitspectra.fetchInterval": 300,
  "gitspectra.fetchOnSave": true,
  "gitspectra.scope.timeWindow": "14d",
  "gitspectra.scope.branches": ["origin/main"],
  "gitspectra.ui.showGutterIcons": true,
  "gitspectra.ui.showStatusBar": true
}
```

### 7.3 Team Config File

```json
// .gitspectra.json
{
  "$schema": "https://gitspectra.dev/schema/v1.json",
  "version": "1.0",

  "scope": {
    // Only track commits from team members
    "authors": ["@team"],

    // Only look at last 2 weeks of commits
    "timeWindow": "14d",

    // Check against these branches
    "branches": ["origin/main", "origin/develop", "origin/release/*"],

    // Ignore bot branches
    "excludeBranches": [
      "origin/dependabot/*",
      "origin/renovate/*",
      "origin/snyk-*"
    ]
  },

  "team": {
    "members": [
      { "name": "Alice", "email": "alice@acme.com" },
      { "name": "Bob", "email": "bob@acme.com" },
      { "name": "Charlie", "email": "charlie@acme.com" }
    ]
  },

  "files": {
    // Only check source files
    "include": ["src/**/*", "lib/**/*"],

    // Ignore tests and config
    "exclude": ["**/*.test.*", "**/*.spec.*", "*.config.*"]
  }
}
```

---

## 8. User Interface

### 8.1 Gutter Decorations

```
  1 │    import React from 'react';
  2 │    import { Button } from './Button';
  3 │
🔴4 │    export function Header() {        ← Conflict with origin/main (Bob, 2h ago)
🔴5 │      const [open, setOpen] = useState(false);
🔴6 │
  7 │      return (
🟡8 │        <header className="header">   ← Warning: nearby change (Alice, 1d ago)
  9 │          <Button onClick={() => setOpen(true)}>
 10 │            Menu
 11 │          </Button>
 12 │        </header>
 13 │      );
 14 │    }
```

### 8.2 Hover Card

```
┌─────────────────────────────────────────────────┐
│ ⚠️ CONFLICT DETECTED                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ 👤 Bob (bob@acme.com)                          │
│ 📅 2 hours ago                                 │
│ 🌿 origin/main                                 │
│                                                 │
│ 💬 "Refactored header component for a11y"      │
│                                                 │
│ Lines 4-6 were modified in this commit.        │
│                                                 │
├─────────────────────────────────────────────────┤
│ [View Diff]  [Open Commit]  [Dismiss]          │
└─────────────────────────────────────────────────┘
```

### 8.3 Status Bar

```
┌──────────────────────────────────────────────────────────────────┐
│ ... | ⚠️ 2 conflicts (Button.tsx, api.ts) | Git: main | ...     │
└──────────────────────────────────────────────────────────────────┘
```

Click to open Conflict Panel.

### 8.4 Conflict Panel (Sidebar)

Located in Activity Bar with shield icon.

**Sections**:

1. **Active Conflicts** - Files with hard conflicts
2. **Warnings** - Files with nearby changes
3. **Recent Changes** - Team activity feed
4. **Configuration** - Quick access to settings

---

## 9. User Stories

### Epic 1: Core Conflict Detection

#### US-001: See conflicts in gutter

> As a developer, I want to see a red indicator next to line 40 because my teammate merged a change to line 40 into main five minutes ago, so I don't waste time writing code that won't merge.

**Acceptance Criteria**:

- [ ] Red dot appears in gutter for conflicting lines
- [ ] Dot appears within 30 seconds of teammate's push (after fetch)
- [ ] Hovering shows commit info

#### US-002: Background fetching

> As a developer, I want the extension to automatically fetch remote changes every 5 minutes so I don't have to remember to run `git fetch`.

**Acceptance Criteria**:

- [ ] Fetch runs automatically at configured interval
- [ ] Fetch does not interrupt typing
- [ ] Fetch status shown in status bar

#### US-003: Manual refresh

> As a developer, I want to manually trigger a conflict check when I know my teammate just pushed, so I get immediate feedback.

**Acceptance Criteria**:

- [ ] Command: "GitSpectra: Check Now"
- [ ] Keyboard shortcut available
- [ ] Loading indicator during check

### Epic 2: Scoped Analysis

#### US-004: Filter by team members

> As a tech lead, I want to only track commits from my direct team of 5 people, not the entire 50-person engineering org, so I see relevant conflicts.

**Acceptance Criteria**:

- [ ] Configure team members in `.gitspectra.json`
- [ ] Only commits from listed authors trigger conflicts
- [ ] Support email and username matching

#### US-005: Filter by time window

> As a developer on a fast-moving project, I only want to see conflicts from the last 7 days, not month-old branches that will never be merged.

**Acceptance Criteria**:

- [ ] Configure time window (e.g., "7d", "14d", "30d")
- [ ] Older commits are ignored
- [ ] Time window updates on each fetch

#### US-006: Filter by branches

> As a developer, I want to only check against `origin/main` and `origin/develop`, ignoring feature branches.

**Acceptance Criteria**:

- [ ] Configure target branches with glob patterns
- [ ] Support include and exclude lists
- [ ] Default to `origin/main` if not configured

### Epic 3: Security & Privacy

#### US-007: Verify no data egress

> As a security-conscious dev, I want to verify that this extension is not sending my code to a cloud server, so I can get it approved by my IT department.

**Acceptance Criteria**:

- [ ] No network requests except `git fetch` to configured remotes
- [ ] No telemetry
- [ ] No external dependencies that phone home
- [ ] Clear privacy statement in README

#### US-008: Works offline

> As a developer on a plane, I want the extension to still show me cached conflict information when I'm offline.

**Acceptance Criteria**:

- [ ] Cached conflicts remain visible when offline
- [ ] Status bar shows "Offline" state
- [ ] Check resumes when network returns

### Epic 4: Team Configuration

#### US-009: Share config with team

> As a tech lead, I want to commit a configuration file that my whole team will use, so everyone has consistent conflict detection.

**Acceptance Criteria**:

- [ ] `.gitspectra.json` in repo root is auto-detected
- [ ] Settings from file apply to all team members
- [ ] Users can override with personal VS Code settings

#### US-010: Configure via UI

> As a new user, I want to configure the extension through a UI rather than editing JSON, so setup is easy.

**Acceptance Criteria**:

- [ ] Settings accessible via command palette
- [ ] Simple wizard for initial setup
- [ ] Generates config file if desired

---

## 10. Non-Functional Requirements

### NFR-001: Privacy First

**Requirement**: STRICTLY NO telemetry or data egress.

**Verification**:

- All network requests logged to output channel
- Code audit confirms no external API calls
- Open source for community verification

### NFR-002: Performance

**Requirement**: Extension must not freeze the editor.

**Constraints**:

- Git operations run asynchronously (never on main thread)
- Fetch debounced (max 1 per 60 seconds even if triggered multiple times)
- Analysis parallelized with concurrency limit (max 5)
- Large files (>10K lines) analyzed with sampling

**Metrics**:

- Fetch: <5s for typical repo
- Analysis: <1s per file
- UI update: <16ms (60fps)

### NFR-003: Platform Support

**Requirement**: Must work on Mac, Windows, and Linux.

**Verification**:

- CI tests on all three platforms
- Path handling works cross-platform
- Git binary detection works everywhere

### NFR-004: Git Compatibility

**Requirement**: Works with Git 2.20+.

**Considerations**:

- Feature detection for newer Git features
- Graceful degradation if feature unavailable
- Clear error if Git too old

### NFR-005: Memory Efficiency

**Requirement**: Extension should not consume excessive memory.

**Constraints**:

- Conflict cache limited to 1000 entries
- Old cache entries evicted (LRU)
- Large diffs not stored in memory

---

## 11. Competitive Analysis

### Cloud-Based Alternatives

| Aspect              | Cloud Tools    | GitSpectra |
| ------------------- | -------------- | ------------- |
| Pricing             | Freemium       | Free (OSS)    |
| Cloud dependency    | Yes (required) | None          |
| Real-time P2P       | Yes            | No (async)    |
| Enterprise-friendly | Limited        | Yes           |
| Configurable scope  | No             | Yes           |
| Team config file    | No             | Yes           |
| Works offline       | No             | Yes           |

**Cloud Tools' Strengths**: Real-time presence, live edit preview
**GitSpectra's Strengths**: Privacy, enterprise adoption, configurability

### CodeStream

| Aspect                  | CodeStream  | GitSpectra       |
| ----------------------- | ----------- | ------------------- |
| Focus                   | Code review | Conflict prevention |
| Cloud dependency        | Yes         | None                |
| Conflict detection      | Limited     | Core feature        |
| Slack/Teams integration | Yes         | No                  |

**Different problem spaces**: CodeStream focuses on review workflow, not conflict prevention.

### Manual Git Workflow

| Aspect     | Manual                   | GitSpectra    |
| ---------- | ------------------------ | ---------------- |
| Effort     | High (remember to fetch) | Low (automatic)  |
| Visibility | Low (terminal only)      | High (in editor) |
| Proactive  | No                       | Yes              |

---

## 12. Roadmap

### Phase 1: MVP (v0.1.0) - 4 weeks

**Goal**: Core conflict detection working end-to-end.

- [ ] Git driver (fetch, merge-tree, log)
- [ ] Basic conflict detection for current file
- [ ] Gutter decorations (red/yellow)
- [ ] Hover information
- [ ] Status bar indicator
- [ ] Basic configuration (target branch only)

### Phase 2: Scoping (v0.2.0) - 2 weeks

**Goal**: Make it usable for large teams/repos.

- [ ] Author filtering
- [ ] Time window filtering
- [ ] Branch pattern filtering
- [ ] `.gitspectra.json` team config

### Phase 3: Polish (v0.3.0) - 2 weeks

**Goal**: Production-ready UX.

- [ ] Conflict Panel (sidebar)
- [ ] Diff view integration
- [ ] Settings UI
- [ ] Welcome/onboarding flow

### Phase 4: Team Features (v0.4.0) - 2 weeks

**Goal**: Better team visibility.

- [ ] Team member definitions
- [ ] Activity feed (who changed what)
- [ ] "@team" author shortcut
- [ ] Notifications (optional)

### Phase 5: Hardening (v1.0.0) - 2 weeks

**Goal**: Enterprise-ready release.

- [ ] Performance optimization
- [ ] Full test coverage
- [ ] Documentation
- [ ] Marketplace publication
- [ ] Security audit

---

## 13. Success Metrics

### Adoption Metrics

| Metric               | Target (6 months) |
| -------------------- | ----------------- |
| Marketplace installs | 10,000            |
| Weekly active users  | 3,000             |
| GitHub stars         | 500               |
| Enterprise adoptions | 5                 |

### Engagement Metrics

| Metric                           | Target       |
| -------------------------------- | ------------ |
| Conflicts detected per user/week | 3+           |
| Config file adoption             | 40% of users |
| Fetch interval < 10 min          | 60% of users |

### Quality Metrics

| Metric           | Target     |
| ---------------- | ---------- |
| Extension rating | 4.5+ stars |
| Crash rate       | <0.1%      |
| Memory usage     | <50MB      |

---

## Appendix A: Git Commands Reference

### Fetch Remote Changes

```bash
git fetch origin
```

### Get Merge Base

```bash
git merge-base origin/main HEAD
```

### Dry-Run Merge (Conflict Detection)

```bash
git merge-tree $(git merge-base origin/main HEAD) origin/main HEAD
```

### Get Commits by Author in Time Range

```bash
git log --author="bob" --since="7 days ago" --oneline
```

### Get Files Changed in Commit

```bash
git diff-tree --no-commit-id --name-only -r <commit>
```

---

## Appendix B: Configuration Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GitSpectra Configuration",
  "type": "object",
  "properties": {
    "version": {
      "type": "string",
      "const": "1.0"
    },
    "fetch": {
      "type": "object",
      "properties": {
        "interval": { "type": "number", "minimum": 0 },
        "onSave": { "type": "boolean" },
        "onFocus": { "type": "boolean" },
        "remotes": { "type": "array", "items": { "type": "string" } }
      }
    },
    "scope": {
      "type": "object",
      "properties": {
        "authors": { "type": "array", "items": { "type": "string" } },
        "timeWindow": { "type": "string", "pattern": "^\\d+[dwmh]$" },
        "branches": { "type": "array", "items": { "type": "string" } },
        "excludeBranches": { "type": "array", "items": { "type": "string" } }
      }
    },
    "team": {
      "type": "object",
      "properties": {
        "members": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "email": { "type": "string" },
              "github": { "type": "string" }
            },
            "required": ["email"]
          }
        }
      }
    },
    "ui": {
      "type": "object",
      "properties": {
        "showInGutter": { "type": "boolean" },
        "showInStatusBar": { "type": "boolean" },
        "conflictColor": { "type": "string" },
        "warningColor": { "type": "string" }
      }
    }
  }
}
```

---

## Appendix C: Open Source Considerations

### License Recommendation

- **MIT License**: Maximum adoption, allows enterprise use
- Alternative: Apache 2.0 (includes patent protection)

### Repository Structure

```
gitspectra/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   └── ISSUE_TEMPLATE/
├── src/
│   ├── extension.ts
│   ├── git/
│   ├── analyzer/
│   ├── ui/
│   └── config/
├── test/
├── docs/
├── .gitspectra.json    (example config)
├── package.json
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── SECURITY.md
```

### Community Building

- Clear CONTRIBUTING.md
- Issue templates (bug, feature request)
- Discussion board enabled
- Regular release cadence
- Responsive to issues (<48h first response)

---

_End of PRD_
