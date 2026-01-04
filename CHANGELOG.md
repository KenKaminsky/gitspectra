# Changelog

All notable changes to GitSpectra will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Demo Mode for Marketing Videos**
  - `GitSpectra: Demo - Start Scenario` - Run pre-built demo scenarios
  - `GitSpectra: Demo - Inject Conflict` - Manually inject a fake conflict
  - `GitSpectra: Demo - Inject Activity` - Manually inject a fake team activity
  - `GitSpectra: Demo - Stop` / `Demo - Reset` - Control demo playback
  - Pre-built scenarios: Conflict Detection, Activity Feed, Full Overview, Privacy, Looping Activity
  - Fake team members with realistic names and Gravatar avatars
  - Timed events for repeatable video recordings

## [0.1.3] - 2026-01-04

### Added

- **Activity Feed Enhancements**
  - Inline commit details expansion with file list
  - View individual file diffs from commit details
  - Open commits and branches on GitHub directly
  - Improved commit navigation and exploration

- **Diff View Improvements**
  - Better handling of renamed/moved files
  - Graceful fallback when local file no longer exists
  - Show remote-only version when file was deleted locally

### Fixed

- **Multi-repo workspace improvements**: Better context switching when navigating between different git repositories in the same workspace
- **File existence checks**: Graceful handling when opening files that have been renamed or deleted
- **Conflict panel refresh**: Proper refresh when switching between repositories

### Changed

- Improved conflict detection algorithm documentation (added `docs/ALGORITHM.md`)

## [0.1.2] - 2026-01-04

### Fixed

- **Multi-project workspace support**: GitSpectra now detects git repos from the active file's directory, not just the workspace root. This enables use when opening a parent folder containing multiple git repos (e.g., `~/Projects/`).
- Added deferred activation: If no git repo is found initially, GitSpectra will auto-activate when you open a file in a git repository.

## [0.1.1] - 2026-01-04

### Changed

- License changed from MIT to **AGPL-3.0** for better open source protection
- Fixed GitHub repository URLs

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

[Unreleased]: https://github.com/KenKaminsky/gitspectra/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/KenKaminsky/gitspectra/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/KenKaminsky/gitspectra/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/KenKaminsky/gitspectra/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/KenKaminsky/gitspectra/releases/tag/v0.1.0
