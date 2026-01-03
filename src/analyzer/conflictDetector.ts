/**
 * Conflict Detector
 *
 * Analyzes files for potential merge conflicts using git merge-tree.
 * Maps conflict markers back to current document line numbers.
 */

import { GitDriver, Commit, ConflictMarker } from "../git/driver.js";
import type { GitSpectraConfig } from "../config/types.js";

export type ConflictSeverity = "hard" | "soft";

export interface ConflictInfo {
  file: string;
  lines: LineRange;
  severity: ConflictSeverity;
  source: ConflictSource;
}

export interface LineRange {
  start: number;
  end: number;
}

export interface ConflictSource {
  branch: string;
  commit: string;
  author: string;
  email: string;
  date: Date;
  message: string;
}

export interface FileConflictReport {
  file: string;
  conflicts: ConflictInfo[];
  warnings: ConflictInfo[];
  lastAnalyzed: Date;
  targetBranch: string;
}

export interface AnalysisResult {
  reports: Map<string, FileConflictReport>;
  totalConflicts: number;
  totalWarnings: number;
  analyzedAt: Date;
}

export class ConflictDetector {
  private git: GitDriver;
  private config: GitSpectraConfig;
  private cache: Map<string, FileConflictReport> = new Map();

  constructor(git: GitDriver, config: GitSpectraConfig) {
    this.git = git;
    this.config = config;
  }

  /**
   * Update configuration
   */
  setConfig(config: GitSpectraConfig): void {
    this.config = config;
    this.invalidateCache();
  }

  /**
   * Invalidate cache for a specific file or all files
   */
  invalidateCache(file?: string): void {
    if (file) {
      this.cache.delete(file);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Analyze a specific file for conflicts
   */
  async analyzeFile(filePath: string): Promise<FileConflictReport | null> {
    const relativePath = this.git.getRelativePath(filePath);

    // Check cache first
    const cached = this.cache.get(relativePath);
    if (cached && Date.now() - cached.lastAnalyzed.getTime() < 60000) {
      // Cache valid for 1 minute
      return cached;
    }

    const conflicts: ConflictInfo[] = [];
    const warnings: ConflictInfo[] = [];

    // Get target branches to check
    const targetBranches = await this.getTargetBranches();

    for (const targetBranch of targetBranches) {
      try {
        const report = await this.checkAgainstBranch(
          relativePath,
          targetBranch
        );
        conflicts.push(...report.conflicts);
        warnings.push(...report.warnings);
      } catch (error) {
        console.error(
          `Error checking ${relativePath} against ${targetBranch}:`,
          error
        );
      }
    }

    const result: FileConflictReport = {
      file: relativePath,
      conflicts,
      warnings,
      lastAnalyzed: new Date(),
      targetBranch: targetBranches[0] || "origin/main",
    };

    this.cache.set(relativePath, result);
    return result;
  }

  /**
   * Analyze all open files
   */
  async analyzeFiles(filePaths: string[]): Promise<AnalysisResult> {
    const reports = new Map<string, FileConflictReport>();
    let totalConflicts = 0;
    let totalWarnings = 0;

    for (const filePath of filePaths) {
      const report = await this.analyzeFile(filePath);
      if (report) {
        reports.set(report.file, report);
        totalConflicts += report.conflicts.length;
        totalWarnings += report.warnings.length;
      }
    }

    return {
      reports,
      totalConflicts,
      totalWarnings,
      analyzedAt: new Date(),
    };
  }

  /**
   * Get target branches based on configuration
   */
  private async getTargetBranches(): Promise<string[]> {
    const configuredBranches = this.config.scope?.branches || ["origin/main"];
    const excludePatterns = this.config.scope?.excludeBranches || [];

    // Filter out excluded branches
    const branches = configuredBranches.filter((branch) => {
      return !excludePatterns.some((pattern) =>
        this.matchesPattern(branch, pattern)
      );
    });

    return branches;
  }

  /**
   * Check if a branch name matches a glob pattern
   */
  private matchesPattern(branch: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(branch);
  }

  /**
   * Check a file against a specific branch
   */
  private async checkAgainstBranch(
    file: string,
    targetBranch: string
  ): Promise<{ conflicts: ConflictInfo[]; warnings: ConflictInfo[] }> {
    const conflicts: ConflictInfo[] = [];
    const warnings: ConflictInfo[] = [];

    try {
      // Get merge base
      const currentBranch = await this.git.getCurrentBranch();
      const mergeBase = await this.git.getMergeBase(targetBranch, currentBranch);

      // Run merge-tree
      const mergeResult = await this.git.mergeTree(mergeBase, targetBranch);

      // Find conflicts for this specific file
      const fileConflicts = mergeResult.conflictMarkers.filter(
        (m) => m.file === file
      );

      if (fileConflicts.length > 0) {
        // Get commit info for the conflicting changes
        const commits = await this.getRelevantCommits(targetBranch, file);
        const latestCommit = commits[0];

        for (const marker of fileConflicts) {
          conflicts.push({
            file,
            lines: { start: marker.startLine, end: marker.endLine },
            severity: "hard",
            source: {
              branch: targetBranch,
              commit: latestCommit?.hash || "unknown",
              author: latestCommit?.author || "Unknown",
              email: latestCommit?.email || "",
              date: latestCommit?.date || new Date(),
              message: latestCommit?.message || "Unknown commit",
            },
          });
        }
      } else {
        // Check for nearby changes (soft warnings)
        const nearbyChanges = await this.checkNearbyChanges(file, targetBranch);
        warnings.push(...nearbyChanges);
      }
    } catch (error) {
      // Silently handle errors for individual branch checks
      console.debug(`Could not check ${file} against ${targetBranch}:`, error);
    }

    return { conflicts, warnings };
  }

  /**
   * Get relevant commits that modified a file on a branch
   */
  private async getRelevantCommits(
    branch: string,
    file: string
  ): Promise<Commit[]> {
    const timeWindow = this.config.scope?.timeWindow || "30d";
    const since = this.parseTimeWindow(timeWindow);

    const commits = await this.git.log({
      branch,
      file,
      since,
      maxCount: 10,
    });

    // Filter by authors if configured
    const authors = this.config.scope?.authors;
    if (authors && authors.length > 0) {
      return commits.filter(
        (c) =>
          authors.includes(c.author) ||
          authors.includes(c.email) ||
          authors.includes("@team")
      );
    }

    return commits;
  }

  /**
   * Parse time window string (e.g., "7d", "2w", "1m") to Git-compatible format
   */
  private parseTimeWindow(window: string): string {
    const match = window.match(/^(\d+)([hdwm])$/);
    if (!match) return "30 days ago";

    const [, value, unit] = match;
    const unitMap: Record<string, string> = {
      h: "hours",
      d: "days",
      w: "weeks",
      m: "months",
    };

    return `${value} ${unitMap[unit]} ago`;
  }

  /**
   * Check for changes near the lines being edited (soft warnings)
   */
  private async checkNearbyChanges(
    file: string,
    targetBranch: string
  ): Promise<ConflictInfo[]> {
    const warnings: ConflictInfo[] = [];

    try {
      const hunks = await this.git.diffFile(file, targetBranch);
      const commits = await this.getRelevantCommits(targetBranch, file);
      const latestCommit = commits[0];

      for (const hunk of hunks) {
        // Parse the hunk content to find actual changed lines
        const changedLines = this.parseHunkForChangedLines(hunk.content, hunk.newStart);
        
        // Create a warning for each contiguous range of changed lines
        const ranges = this.groupIntoRanges(changedLines);
        
        for (const range of ranges) {
          warnings.push({
            file,
            lines: range,
            severity: "soft",
            source: {
              branch: targetBranch,
              commit: latestCommit?.hash || "unknown",
              author: latestCommit?.author || "Unknown",
              email: latestCommit?.email || "",
              date: latestCommit?.date || new Date(),
              message: latestCommit?.message || "Changes detected",
            },
          });
        }
      }
    } catch (error) {
      // File might not exist in target branch
    }

    return warnings;
  }

  /**
   * Parse hunk content to extract actual changed line numbers
   * Only lines starting with + or - are actual changes
   */
  private parseHunkForChangedLines(content: string, startLine: number): number[] {
    const lines = content.split('\n');
    const changedLines: number[] = [];
    
    // Track line number in the "new" file (right side of diff)
    let currentLine = startLine;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // Added line - this is in the remote branch
        // We want to highlight where this would appear in our file
        changedLines.push(currentLine);
        currentLine++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        // Deleted line - exists in our file but not in remote
        // Don't increment currentLine as this line doesn't exist in new file
        changedLines.push(currentLine);
      } else if (!line.startsWith('\\')) {
        // Context line (unchanged)
        currentLine++;
      }
    }
    
    return changedLines;
  }

  /**
   * Group individual line numbers into contiguous ranges
   * e.g., [1, 2, 3, 7, 8] -> [{start: 1, end: 3}, {start: 7, end: 8}]
   */
  private groupIntoRanges(lines: number[]): LineRange[] {
    if (lines.length === 0) return [];
    
    // Sort and deduplicate
    const sorted = [...new Set(lines)].sort((a, b) => a - b);
    
    const ranges: LineRange[] = [];
    let rangeStart = sorted[0];
    let rangeEnd = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === rangeEnd + 1) {
        // Contiguous - extend the range
        rangeEnd = sorted[i];
      } else {
        // Gap - save current range and start new one
        ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = sorted[i];
        rangeEnd = sorted[i];
      }
    }
    
    // Don't forget the last range
    ranges.push({ start: rangeStart, end: rangeEnd });
    
    return ranges;
  }
}

