# 🏢 Enterprise Ready

**Approved by even the strictest IT policies.**

---

## Overview

GitSpectra is designed for teams that need privacy, work in regulated industries, or want async conflict detection without cloud dependencies. Its 100% local architecture makes it suitable for the most security-conscious environments.

<!-- SCREENSHOT: Enterprise security illustration -->
![Enterprise security](./images/enterprise-security.png)
*Placeholder: Illustration showing GitSpectra in a secure enterprise environment*

---

## Security Benefits

### No Data Exfiltration Risk

- Code never leaves developer machines
- No cloud services to compromise
- No API endpoints to attack
- No third-party data processors

### Zero Attack Surface

- No authentication tokens to steal
- No network services to exploit
- No stored credentials
- No external dependencies at runtime

### Audit Trail

- All operations use standard Git commands
- Activity is logged locally (opt-in)
- No hidden network calls
- Fully open source for security review

---

## Compliance Ready

GitSpectra supports organizations with strict compliance requirements:

| Regulation | How GitSpectra Helps |
|------------|---------------------|
| **SOC 2** | No data transmission means no third-party data processor concerns |
| **HIPAA** | PHI in code never leaves the local machine |
| **GDPR** | No personal data collected or transmitted |
| **FedRAMP** | Works in air-gapped and classified environments |
| **PCI DSS** | Cardholder data in code stays local |

---

## Air-Gapped Environments

GitSpectra works perfectly in air-gapped or isolated networks:

<!-- SCREENSHOT: Air-gapped environment diagram -->
![Air-gapped environment](./images/enterprise-airgapped.png)
*Placeholder: Diagram showing GitSpectra in isolated network*

1. Install the extension via VSIX file
2. Configure to skip `git fetch` or use internal mirrors
3. All analysis runs on local Git data

### Installation Without Internet

```bash
# Download VSIX from releases
# Transfer to air-gapped machine
code --install-extension gitspectra-0.1.3.vsix
```

---

## Team Deployment

### Centralized Configuration

Commit a `.gitspectra.json` to your repository:

```json
{
  "version": "1.0",
  "scope": {
    "branches": ["origin/main", "origin/develop"],
    "timeWindow": "14d",
    "authors": ["@myorg"]
  }
}
```

All team members automatically use the same settings.

### No Account Management

- No user provisioning needed
- No SSO integration required
- No license servers to maintain
- Works with any Git remote

---

## IT Administration

### Easy Approval

When presenting to IT/Security teams:

✅ **Open Source** — Full source code available for audit  
✅ **No Network** — Only uses standard `git fetch`  
✅ **No Cloud** — Zero external service dependencies  
✅ **No Data Collection** — No telemetry or analytics  
✅ **Standard Git** — Uses only built-in Git commands  
✅ **AGPL Licensed** — Transparent licensing terms  

### Deployment Options

| Method | Best For |
|--------|----------|
| **VS Code Marketplace** | Standard corporate networks |
| **VSIX sideload** | Restricted networks |
| **Internal registry** | Large enterprise deployments |

---

## Licensing

GitSpectra is licensed under **AGPL-3.0**, which:

- ✅ Allows commercial use
- ✅ Allows modification
- ⚠️ Requires source disclosure if you modify and distribute
- ⚠️ Network use triggers disclosure requirements

### Commercial Licensing

Need to use GitSpectra in a proprietary product or want to avoid AGPL obligations? Contact us for commercial licensing options.

---

## Support

Enterprise support options:

- **Community** — GitHub Issues and Discussions
- **Priority Support** — Contact for SLA-backed support
- **Custom Development** — Feature development for your needs

---

## Related Features

- [100% Local Operation](./privacy-local.md) — Technical privacy details
- [Team Configuration](./team-config.md) — Centralized settings
- [Multi-Repo Workspaces](./multi-repo.md) — Enterprise workspace support

