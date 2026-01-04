# 🔒 100% Local Operation

**Your code never leaves your machine.**

---

## Overview

GitSpectra is built from the ground up for privacy. Everything happens locally on your computer—no cloud services, no data transmission, no accounts required.

<!-- SCREENSHOT: Diagram showing local-only operation -->
![Local operation diagram](./images/privacy-local-diagram.png)
*Placeholder: Diagram showing GitSpectra operating entirely within the user's machine*

---

## What "100% Local" Means

### No Cloud Services

- ❌ No servers to connect to
- ❌ No authentication required
- ❌ No API keys needed
- ❌ No subscriptions or accounts

### No Data Transmission

- ❌ No telemetry or analytics
- ❌ No code sent to external services
- ❌ No usage data collected
- ❌ No crash reports uploaded

### No Network Required

GitSpectra works completely offline—the only network activity is `git fetch`, which you already do:

```
┌──────────────────────────────────┐
│         Your Computer            │
│  ┌─────────────────────────────┐ │
│  │       VS Code + GitSpectra  │ │
│  │  ┌──────────┐ ┌───────────┐ │ │
│  │  │ Analysis │ │ UI Update │ │ │
│  │  └────▲─────┘ └───────────┘ │ │
│  │       │                     │ │
│  │  ┌────┴─────┐               │ │
│  │  │ Local Git│               │ │
│  │  │ Commands │               │ │
│  │  └────▲─────┘               │ │
│  └───────┼─────────────────────┘ │
│          │                       │
│  ┌───────┴───────┐               │
│  │   .git folder │               │
│  │  (your repo)  │               │
│  └───────────────┘               │
└──────────────────────────────────┘
         ▲
         │ git fetch (you control this)
         ▼
┌──────────────────────────────────┐
│       Git Remote (GitHub, etc.) │
└──────────────────────────────────┘
```

---

## Commands Used

GitSpectra only runs standard Git commands:

| Command | Purpose |
|---------|---------|
| `git fetch` | Get latest remote refs |
| `git merge-tree` | Simulate merges locally |
| `git log` | Read commit history |
| `git diff` | Compare file versions |
| `git config` | Read local settings |
| `git rev-parse` | Resolve refs |

All of these operate on your local `.git` folder. No code content is ever transmitted.

---

## Privacy Guarantees

### Your Code Stays Private

- Source code is never read by external services
- Commit messages stay local
- Branch names and repo structure are not shared

### No Fingerprinting

- No unique identifiers generated
- No machine identification
- No tracking across sessions

### No Dependencies

- Zero runtime network dependencies
- Works in air-gapped environments
- Functions during network outages

---

## Verification

Don't take our word for it—verify yourself:

### Network Monitoring

Run GitSpectra while monitoring network traffic. You'll see only `git fetch` to your configured remotes.

### Source Code

GitSpectra is [open source under AGPL-3.0](https://github.com/KenKaminsky/gitspectra). Audit the code yourself.

### Offline Testing

Disconnect from the internet. GitSpectra continues to work (using cached git data).

---

## Comparison

| Aspect | Cloud-Based Tools | GitSpectra |
|--------|-------------------|------------|
| **Data location** | Their servers | Your machine only |
| **Network required** | Always | Only for git fetch |
| **Account needed** | Yes | No |
| **Telemetry** | Usually yes | None |
| **Offline capable** | No | Yes |
| **Audit possible** | No | Yes (open source) |

---

## Related Features

- [Enterprise Ready](./enterprise.md) — Compliance and security benefits
- [Team Configuration](./team-config.md) — Share settings without cloud
- [Configurable Scope](./configurable-scope.md) — Control what's analyzed

