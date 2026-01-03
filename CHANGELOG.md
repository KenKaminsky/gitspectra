# Changelog

All notable changes to GitSpectra will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-03

### Added

- **Core Conflict Detection**
  - Real-time conflict detection using `git merge-tree`
  - Gutter icons with author avatars (Gravatar)
  - Line highlighting for conflict locations
  - Accurate changed-line detection (only actual diff lines, not context)

- **UI Components**
  - Status bar showing conflict/warning count
  - Rich hover tooltips with author, branch, commit info
  - File explorer badges for files with conflicts
  - Conflict Radar panel (sidebar tree view)
  - Activity Feed panel with Timeline, By Person, and Hot Files views

- **Configuration**
  - VS Code settings integration
  - `.gitspectra.json` team configuration file support
  - Configurable fetch intervals
  - Branch filtering and exclusion patterns
  - Author filtering
  - Time window configuration

- **Commands**
  - `GitSpectra: Check Now` - Manual conflict check
  - `GitSpectra: Show Panel` - Open conflict panel
  - `GitSpectra: Configure` - Open settings
  - `GitSpectra: Dismiss All` - Clear all indicators
  - `GitSpectra: Copy Logs` - Copy debug logs
  - `GitSpectra: View Diff` - Open side-by-side diff

### Security

- 100% local operation - no network calls except `git fetch`
- No telemetry or data collection
- No external dependencies at runtime

---

[Unreleased]: https://github.com/gitspectra/gitspectra/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gitspectra/gitspectra/releases/tag/v0.1.0

