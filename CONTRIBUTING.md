# Contributing to GitSpectra

First off, thank you for considering contributing to GitSpectra! It's people like you that make GitSpectra a great tool for developers everywhere.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [existing issues](https://github.com/gitspectra/gitspectra/issues) as you might find that the issue has already been reported.

When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide the GitSpectra logs** (run `GitSpectra: Copy Logs` command)
- **Describe the behavior you observed and what you expected**
- **Include your VS Code version and OS**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed enhancement**
- **Explain why this enhancement would be useful**
- **List any alternatives you've considered**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue your pull request!

### License Agreement

By contributing to GitSpectra, you agree that your contributions will be licensed under the **AGPL-3.0** license. This ensures all improvements remain open source and benefit the community.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/gitspectra.git
cd gitspectra

# Install dependencies
npm install

# Start the watch mode
npm run watch

# In VS Code, press F5 to launch the Extension Development Host
```

### Project Structure

```
src/
├── extension.ts          # Main entry point
├── analyzer/             # Conflict detection logic
│   └── conflictDetector.ts
├── config/               # Configuration handling
│   ├── loader.ts
│   └── types.ts
├── git/                  # Git CLI wrapper
│   └── driver.ts
├── ui/                   # VS Code UI components
│   ├── decorations.ts    # Editor gutter/line decorations
│   ├── fileDecorations.ts # Explorer file badges
│   ├── statusBar.ts      # Status bar item
│   ├── conflictPanel.ts  # Sidebar tree view
│   └── activityFeed.ts   # Activity webview panel
└── utils/
    └── logger.ts         # Centralized logging
```

### Coding Style

- **TypeScript**: All code must be in TypeScript
- **No external dependencies**: We avoid runtime dependencies to keep the extension lightweight
- **Async/await**: Prefer async/await over callbacks or raw promises
- **Error handling**: Always handle errors gracefully; never crash the extension
- **Privacy first**: Never add code that sends data outside the user's machine

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new conflict severity indicator
fix: resolve issue with git fetch on Windows
docs: update README with new configuration options
refactor: simplify conflict detection logic
test: add unit tests for GitDriver
chore: update dependencies
```

### Running Tests

```bash
# Run tests once
npm test

# Watch mode
npm run test:watch
```

### Building

```bash
# Development build
npm run build

# Production build (for publishing)
npm run vscode:prepublish
```

## Release Process

Releases are handled by maintainers. The process:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a GitHub release
4. GitHub Actions publishes to VS Code Marketplace

## Questions?

Feel free to open a [Discussion](https://github.com/gitspectra/gitspectra/discussions) if you have questions!

---

Thank you for contributing! 🛡️

