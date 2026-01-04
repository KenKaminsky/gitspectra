# Release Process

This document describes how to release a new version of GitSpectra.

## Quick Reference

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Push with tags
git push origin main --tags

# 3. Wait for GitHub Actions to publish
# Check: https://github.com/KenKaminsky/gitspectra/actions
```

---

## Detailed Release Steps

### 1. Prepare the Release

#### Update CHANGELOG.md

Move items from `[Unreleased]` to a new version section:

```markdown
## [Unreleased]
<!-- Keep this empty after release -->

## [0.1.4] - 2026-01-05

### Added
- New feature X
- New feature Y

### Fixed
- Bug fix Z
```

Add the comparison link at the bottom:

```markdown
[0.1.4]: https://github.com/KenKaminsky/gitspectra/compare/v0.1.3...v0.1.4
```

#### Verify Everything Works

```bash
# Build and lint
npm run build
npm run lint

# Package locally to verify
npx vsce package --no-dependencies

# Test the VSIX manually if needed
code --install-extension gitspectra-*.vsix
```

### 2. Bump Version

Use npm to update `package.json` and create a git tag:

```bash
# Patch release (0.1.3 → 0.1.4)
npm version patch -m "v%s"

# Minor release (0.1.3 → 0.2.0)
npm version minor -m "v%s"

# Major release (0.1.3 → 1.0.0)
npm version major -m "v%s"
```

This automatically:
1. Updates `version` in `package.json`
2. Creates a git commit with message `v0.1.4`
3. Creates a git tag `v0.1.4`

### 3. Push to GitHub

```bash
# Push the commit AND the tag
git push origin main --tags
```

⚠️ **Important**: You must push with `--tags` to trigger the publish workflow!

### 4. Monitor the Release

1. Go to [GitHub Actions](https://github.com/KenKaminsky/gitspectra/actions)
2. Watch the "Publish Extension" workflow
3. Verify it completes successfully

If it fails:
- Check the workflow logs for errors
- Verify secrets are configured (see below)
- Fix issues and re-run the workflow

### 5. Verify Publication

After the workflow completes:

- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=gitspectra.gitspectra
- **Open VSX**: https://open-vsx.org/extension/gitspectra/gitspectra
- **GitHub Releases**: https://github.com/KenKaminsky/gitspectra/releases

Note: Marketplaces may take 5-15 minutes to show the new version.

---

## Required Secrets

The following secrets must be configured in GitHub repository settings:

| Secret | Description | How to Get |
|--------|-------------|------------|
| `VSCE_PAT` | VS Code Marketplace Personal Access Token | [Azure DevOps](https://dev.azure.com/) → User Settings → Personal Access Tokens |
| `OVSX_PAT` | Open VSX Access Token | [Open VSX](https://open-vsx.org/) → Account → Access Tokens |

### Setting Up VSCE_PAT

1. Go to https://dev.azure.com/
2. Sign in with your Microsoft account
3. Click User Settings (gear icon) → Personal Access Tokens
4. Create a new token with:
   - **Organization**: All accessible organizations
   - **Scopes**: Marketplace → Manage
   - **Expiration**: Set a reminder to renew
5. Copy the token and add to GitHub secrets

### Setting Up OVSX_PAT

1. Go to https://open-vsx.org/
2. Sign in with GitHub
3. Go to Account → Access Tokens
4. Create a new token
5. Copy the token and add to GitHub secrets

### Adding Secrets to GitHub

1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `VSCE_PAT` and `OVSX_PAT`

---

## Manual Release (Emergency)

If GitHub Actions fails or you need to publish manually:

```bash
# Build
npm run build

# Package
npx vsce package --no-dependencies

# Publish to VS Code Marketplace
npx vsce publish -p YOUR_VSCE_PAT

# Publish to Open VSX
npx ovsx publish -p YOUR_OVSX_PAT
```

---

## Dry Run

To test the release process without publishing:

1. Go to GitHub Actions
2. Select "Publish Extension" workflow
3. Click "Run workflow"
4. Check "Dry run" option
5. Click "Run workflow"

This will build and package but not publish.

---

## Version Number Guidelines

Follow [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fixes, minor tweaks | Patch | 0.1.3 → 0.1.4 |
| New features (backward compatible) | Minor | 0.1.3 → 0.2.0 |
| Breaking changes | Major | 0.1.3 → 1.0.0 |

For pre-1.0 releases, minor versions can include breaking changes.

---

## Troubleshooting

### "Extension with same version already exists"

The marketplace rejects duplicate versions. You must bump the version number for each release.

### "Personal access token is invalid"

- Token may have expired → create a new one
- Token may have wrong permissions → ensure "Marketplace: Manage" scope
- Token may be for wrong organization → use "All accessible organizations"

### "GitHub Action not triggered"

- Ensure you pushed with `--tags`: `git push origin main --tags`
- Check that the tag matches pattern `v*.*.*` (e.g., `v0.1.4`)

### "Package validation failed"

- Run `npx vsce package` locally to see detailed errors
- Check that `package.json` has all required fields
- Ensure images and README are present

---

## Release Checklist

Before each release:

- [ ] CHANGELOG.md updated with new version section
- [ ] All changes committed
- [ ] Build passes: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Version bumped: `npm version patch|minor|major`
- [ ] Pushed with tags: `git push origin main --tags`
- [ ] GitHub Actions workflow succeeded
- [ ] Verified on VS Code Marketplace
- [ ] Verified on Open VSX

