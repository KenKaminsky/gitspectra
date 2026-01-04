# GitSpectra Conflict Detection Algorithm

## Overview

GitSpectra detects **potential merge conflicts** before they happen by analyzing the relationship between your local changes and changes made by others on remote branches. The algorithm is designed to be **precise** (minimize false positives) while still **catching real conflicts** early.

## Core Principle

A conflict only occurs when:
1. **You changed** specific lines in a file
2. **Someone else changed** the same (or nearby) lines in the target branch
3. The changes are **different** from each other

Simply having different content between branches is NOT a conflict - that's just normal development.

## Two-Tier Detection System

### Tier 1: Hard Conflicts (Definite Merge Failures)

These are conflicts that `git merge` would definitely fail on.

**Method:** `git merge-tree`

```
git merge-tree <merge-base> <target-branch> HEAD
```

**What it detects:**
- Exact line collisions (both branches modified the same line differently)
- Produces conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)

**Visualization:** 🔴 Red indicators, high priority

### Tier 2: Soft Warnings (Potential Conflicts)

These are changes that might cause issues during merge or code review.

**Algorithm:**

```
1. Find the merge-base (common ancestor)
   merge_base = git merge-base <target-branch> HEAD

2. Get THEIR changes (target branch since divergence)
   their_changes = git diff merge_base...target_branch -- <file>

3. Get YOUR changes (your branch since divergence)  
   your_changes = git diff merge_base...HEAD -- <file>

4. Find OVERLAP (lines within ±3 of each other)
   overlap = their_lines ∩ (your_lines ± 3)

5. Only warn if overlap exists
```

**Visualization:** 🟡 Yellow/Orange indicators, informational

## Visual Diagram

```
         merge-base (common ancestor)
              │
              ├────────────────────┐
              │                    │
              ▼                    ▼
         YOUR BRANCH          TARGET BRANCH
         (HEAD)               (origin/main)
              │                    │
         You changed          They changed
         lines 50-55          lines 52-58
              │                    │
              └────────┬───────────┘
                       │
                  OVERLAP DETECTED
                  Lines 52-55 ⚠️
```

## Edge Cases Handled

### New Files
- If file doesn't exist in target branch → **No warning**
- Rationale: Can't conflict with something that doesn't exist

### Deleted Files
- If file was deleted in target branch → **Hard conflict**
- Rationale: You're editing a file they removed

### No Overlap
- You edit line 10, they edit line 200 → **No warning**
- Rationale: Changes are independent, merge will succeed

### Adjacent Changes
- You edit line 50, they edit line 48 → **Warning** (within ±3 buffer)
- Rationale: Context might be affected, worth reviewing

## Configuration Options

```json
{
  "gitspectra.scope.branches": ["origin/main", "origin/develop"],
  "gitspectra.scope.timeWindow": "30d",
  "gitspectra.scope.authors": ["@team"]
}
```

- **branches**: Which branches to check for conflicts against
- **timeWindow**: How far back to look for changes
- **authors**: Filter to specific authors (or `@team` for all)

## Performance Considerations

1. **Caching**: Merge-base is cached per branch pair
2. **Lazy Loading**: Only analyze files that are currently open
3. **Debouncing**: Don't re-analyze on every keystroke
4. **Background Fetch**: Remote changes fetched periodically, not blocking

## Git Commands Used

| Purpose | Command |
|---------|---------|
| Find common ancestor | `git merge-base <branch1> <branch2>` |
| Simulate merge | `git merge-tree <base> <branch> HEAD` |
| Their changes | `git diff <base>...<target> -- <file>` |
| Your changes | `git diff <base>...HEAD -- <file>` |
| File exists check | `git cat-file -e <ref>:<file>` |
| Recent commits | `git log --since="30d" <branch> -- <file>` |

## Future Improvements

### Planned
- [ ] Stacked branches support (check entire stack for conflicts)
- [ ] Semantic conflict detection (same function modified differently)
- [ ] Configurable overlap buffer (currently hardcoded to ±3 lines)
- [ ] Conflict probability scoring

### Under Consideration
- [ ] Integration with PR systems for cross-PR conflict detection
- [ ] Machine learning for conflict pattern recognition
- [ ] Real-time collaboration awareness (who's editing what now)

## References

- [Git Merge-Tree Documentation](https://git-scm.com/docs/git-merge-tree)
- [Git Diff Documentation](https://git-scm.com/docs/git-diff)
- [Understanding Git Merge-Base](https://git-scm.com/docs/git-merge-base)

