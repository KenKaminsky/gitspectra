/**
 * Git Driver
 *
 * Lightweight wrapper around the local Git CLI using child_process.
 * No external dependencies - direct Git binary execution.
 */

import { execSync } from "child_process";
import * as path from "path";

export interface Commit {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
}

export interface MergeTreeResult {
  hasConflicts: boolean;
  output: string;
  conflictMarkers: ConflictMarker[];
}

export interface ConflictMarker {
  file: string;
  startLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
  theirsBranch: string;
}

export interface LogOptions {
  branch?: string;
  author?: string;
  since?: string;
  maxCount?: number;
  file?: string;
}

export interface DiffResult {
  files: DiffFile[];
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export class GitDriver {
  private repoPath: string;
  private gitPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.gitPath = this.findGitBinary();
  }

  /**
   * Find the Git binary path
   */
  private findGitBinary(): string {
    try {
      // Try to find git in PATH
      const result = execSync("which git", { encoding: "utf-8" }).trim();
      return result || "git";
    } catch {
      return "git"; // Fall back to assuming it's in PATH
    }
  }

  /**
   * Execute a git command
   * Uses spawn-style execution to avoid shell interpretation issues
   */
  private async execute(
    args: string[],
    options: { maxBuffer?: number } = {}
  ): Promise<string> {
    // Use array form to avoid shell interpretation of special characters
    const { spawn } = await import("child_process");
    
    return new Promise((resolve, reject) => {
      const proc = spawn(this.gitPath, args, {
        cwd: this.repoPath,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed (${code}): ${stderr || stdout}`));
        }
      });

      proc.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Check if this is a valid Git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await this.execute(["rev-parse", "--git-dir"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the repository root path
   */
  async getRepoRoot(): Promise<string> {
    const result = await this.execute(["rev-parse", "--show-toplevel"]);
    return result.trim();
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const result = await this.execute(["rev-parse", "--abbrev-ref", "HEAD"]);
    return result.trim();
  }

  /**
   * Fetch from remote
   */
  async fetch(remote: string = "origin"): Promise<void> {
    await this.execute(["fetch", remote, "--prune"]);
  }

  /**
   * Get remote branches
   */
  async getRemoteBranches(): Promise<string[]> {
    const result = await this.execute([
      "branch",
      "-r",
      "--format=%(refname:short)",
    ]);
    return result
      .trim()
      .split("\n")
      .filter((b) => b.length > 0);
  }

  /**
   * Get the merge base between two branches
   */
  async getMergeBase(branch1: string, branch2: string): Promise<string> {
    const result = await this.execute(["merge-base", branch1, branch2]);
    return result.trim();
  }

  /**
   * Run merge-tree to detect conflicts without modifying working directory
   */
  async mergeTree(
    base: string,
    target: string,
    current?: string
  ): Promise<MergeTreeResult> {
    const currentRef = current || "HEAD";

    try {
      // Use git merge-tree to simulate merge
      const output = await this.execute([
        "merge-tree",
        base,
        target,
        currentRef,
      ]);

      // Parse for conflict markers
      const hasConflicts = output.includes("<<<<<<<");
      const conflictMarkers = this.parseConflictMarkers(output);

      return {
        hasConflicts,
        output,
        conflictMarkers,
      };
    } catch (error) {
      // merge-tree can exit with non-zero on conflicts
      const errorOutput = error instanceof Error ? error.message : String(error);
      const hasConflicts = errorOutput.includes("<<<<<<<");

      return {
        hasConflicts,
        output: errorOutput,
        conflictMarkers: hasConflicts
          ? this.parseConflictMarkers(errorOutput)
          : [],
      };
    }
  }

  /**
   * Parse conflict markers from merge-tree output
   */
  private parseConflictMarkers(output: string): ConflictMarker[] {
    const markers: ConflictMarker[] = [];
    const lines = output.split("\n");

    let currentFile = "";
    let inConflict = false;
    let conflictStart = 0;
    let oursContent: string[] = [];
    let theirsContent: string[] = [];
    let theirsBranch = "";
    let inOurs = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect file header (e.g., "diff --git a/file.ts b/file.ts")
      if (line.startsWith("diff --git")) {
        const match = line.match(/diff --git a\/(.+) b\//);
        if (match) {
          currentFile = match[1];
        }
      }

      // Start of conflict
      if (line.startsWith("<<<<<<<")) {
        inConflict = true;
        inOurs = true;
        conflictStart = i;
        oursContent = [];
        theirsContent = [];
      }
      // Separator
      else if (line === "=======") {
        inOurs = false;
      }
      // End of conflict
      else if (line.startsWith(">>>>>>>")) {
        theirsBranch = line.replace(">>>>>>>", "").trim();
        markers.push({
          file: currentFile,
          startLine: conflictStart,
          endLine: i,
          oursContent: oursContent.join("\n"),
          theirsContent: theirsContent.join("\n"),
          theirsBranch,
        });
        inConflict = false;
      }
      // Content within conflict
      else if (inConflict) {
        if (inOurs) {
          oursContent.push(line);
        } else {
          theirsContent.push(line);
        }
      }
    }

    return markers;
  }

  /**
   * Get commit log
   */
  async log(options: LogOptions = {}): Promise<Commit[]> {
    const args = [
      "log",
      "--format=%H|%an|%ae|%aI|%s",
      options.maxCount ? `-n${options.maxCount}` : "-n100",
    ];

    if (options.branch) {
      args.push(options.branch);
    }

    if (options.author) {
      args.push(`--author=${options.author}`);
    }

    if (options.since) {
      args.push(`--since="${options.since}"`);
    }

    if (options.file) {
      args.push("--", options.file);
    }

    const result = await this.execute(args);

    return result
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const [hash, author, email, date, message] = line.split("|");
        return {
          hash,
          author,
          email,
          date: new Date(date),
          message,
        };
      });
  }

  /**
   * Get diff between two refs
   */
  async diff(ref1: string, ref2: string, file?: string): Promise<DiffResult> {
    const args = ["diff", ref1, ref2, "--unified=3"];
    if (file) {
      args.push("--", file);
    }

    const output = await this.execute(args);
    return this.parseDiff(output);
  }

  /**
   * Get diff for a specific file against a branch
   */
  async diffFile(
    file: string,
    targetBranch: string
  ): Promise<DiffHunk[]> {
    const args = ["diff", targetBranch, "--", file];
    const output = await this.execute(args);
    const result = this.parseDiff(output);
    return result.files[0]?.hunks || [];
  }

  /**
   * Parse unified diff output
   */
  private parseDiff(output: string): DiffResult {
    const files: DiffFile[] = [];
    const fileChunks = output.split(/^diff --git/m).slice(1);

    for (const chunk of fileChunks) {
      const lines = chunk.split("\n");
      const headerMatch = lines[0].match(/a\/(.+) b\/(.+)/);
      if (!headerMatch) continue;

      const filePath = headerMatch[2];
      const hunks: DiffHunk[] = [];
      let additions = 0;
      let deletions = 0;

      let currentHunk: DiffHunk | null = null;
      let hunkContent: string[] = [];

      for (const line of lines) {
        // Hunk header: @@ -start,count +start,count @@
        const hunkMatch = line.match(
          /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
        );
        if (hunkMatch) {
          // Save previous hunk
          if (currentHunk) {
            currentHunk.content = hunkContent.join("\n");
            hunks.push(currentHunk);
          }

          currentHunk = {
            oldStart: parseInt(hunkMatch[1]),
            oldLines: parseInt(hunkMatch[2] || "1"),
            newStart: parseInt(hunkMatch[3]),
            newLines: parseInt(hunkMatch[4] || "1"),
            content: "",
          };
          hunkContent = [];
        } else if (currentHunk) {
          hunkContent.push(line);
          if (line.startsWith("+") && !line.startsWith("+++")) {
            additions++;
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            deletions++;
          }
        }
      }

      // Save last hunk
      if (currentHunk) {
        currentHunk.content = hunkContent.join("\n");
        hunks.push(currentHunk);
      }

      files.push({ path: filePath, additions, deletions, hunks });
    }

    return { files };
  }

  /**
   * Get files changed in a specific commit
   */
  async getChangedFiles(commit: string): Promise<string[]> {
    const result = await this.execute([
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      commit,
    ]);
    return result
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);
  }

  /**
   * Show content of a file at a specific ref
   */
  async showFile(ref: string, file: string): Promise<string> {
    return await this.execute(["show", `${ref}:${file}`]);
  }

  /**
   * Get the relative path of a file from repo root
   */
  getRelativePath(absolutePath: string): string {
    return path.relative(this.repoPath, absolutePath);
  }
}

