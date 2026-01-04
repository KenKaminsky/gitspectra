/**
 * Conflict Panel - TreeView Provider
 *
 * Shows a comprehensive panel with:
 * - Tracked branches
 * - Team members and their activity
 * - Conflicts per branch/person
 */

import * as vscode from "vscode";
import * as path from "path";
import * as crypto from "crypto";
import type { GitDriver, Commit } from "../git/driver.js";
import type { GitSpectraConfig } from "../config/types.js";
import { log } from "../utils/logger.js";

// Tree item types
type TreeItemType =
  | "section"
  | "branch"
  | "author"
  | "file"
  | "conflict"
  | "info";

interface ConflictPanelItem extends vscode.TreeItem {
  itemType: TreeItemType;
  children?: ConflictPanelItem[];
  filePath?: string;
  branch?: string;
  author?: string;
}

interface AuthorActivity {
  name: string;
  email: string;
  lastActive: Date;
  branches: BranchActivity[];
  totalConflicts: number;
}

interface BranchActivity {
  name: string;
  lastCommit: Commit;
  changedFiles: string[];
  conflictingFiles: string[];
  aheadBy: number;
}

export class ConflictPanelProvider
  implements vscode.TreeDataProvider<ConflictPanelItem>
{
  private git: GitDriver;
  private config: GitSpectraConfig;
  private workspacePath: string;
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ConflictPanelItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private authorActivities: Map<string, AuthorActivity> = new Map();
  private trackedBranch: string = "origin/main";
  private aheadBehind: { ahead: number; behind: number } = {
    ahead: 0,
    behind: 0,
  };

  constructor(git: GitDriver, config: GitSpectraConfig, workspacePath?: string) {
    this.git = git;
    this.config = config;
    this.workspacePath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
  }

  // ========== Demo Mode Methods ==========

  private demoConflicts: Map<string, any> = new Map();

  /**
   * Inject a demo conflict (for marketing videos)
   */
  public injectDemoConflict(file: string, report: any): void {
    log("Panel", `Injecting demo conflict for ${file}`);
    this.demoConflicts.set(file, report);
  }

  /**
   * Clear all demo data
   */
  public clearDemoData(): void {
    log("Panel", "Clearing demo data");
    this.demoConflicts.clear();
  }

  // ========== End Demo Mode Methods ==========

  /**
   * Get Gravatar URL for an email address
   */
  private getGravatarUrl(email: string, size: number = 32): vscode.Uri {
    const hash = crypto.createHash("md5").update(email.toLowerCase().trim()).digest("hex");
    return vscode.Uri.parse(`https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`);
  }

  /**
   * Refresh the panel data
   */
  async refresh(): Promise<void> {
    log("Panel", "Refreshing conflict panel...");

    try {
      // Get current branch
      const currentBranch = await this.git.getCurrentBranch();
      log("Panel", `Current branch: ${currentBranch}`);

      // Get tracked branch info
      await this.updateTrackedBranchInfo();

      // Get recent authors and their activity
      await this.updateAuthorActivities();

      // Notify tree to refresh
      this._onDidChangeTreeData.fire(undefined);

      log("Panel", `Panel refreshed: ${this.authorActivities.size} authors found`);
    } catch (error) {
      log("Panel", `Error refreshing panel: ${error}`);
    }
  }

  /**
   * Update tracked branch information
   */
  private async updateTrackedBranchInfo(): Promise<void> {
    try {
      const branches = this.config.scope?.branches || ["origin/main"];
      this.trackedBranch = branches[0];

      // Get ahead/behind count
      const currentBranch = await this.git.getCurrentBranch();
      // Note: This would need a git rev-list command to get accurate counts
      // For now, we'll estimate from recent commits
      const commits = await this.git.log({
        branch: this.trackedBranch,
        maxCount: 50,
      });
      this.aheadBehind.behind = commits.length > 20 ? 20 : commits.length;
    } catch (error) {
      log("Panel", `Error getting tracked branch info: ${error}`);
    }
  }

  /**
   * Update author activities from recent commits
   */
  private async updateAuthorActivities(): Promise<void> {
    this.authorActivities.clear();

    try {
      // Get ALL remote branches with recent activity
      const timeWindow = this.config.scope?.timeWindow || "14d";
      const since = this.parseTimeWindow(timeWindow);
      
      // Get all remote branches
      let branches: string[] = [];
      try {
        const allRemoteBranches = await this.git.getRemoteBranches();
        
        // Filter out excluded patterns
        const excludePatterns = this.config.scope?.excludeBranches || [
          "origin/dependabot/*",
          "origin/renovate/*",
        ];
        
        branches = allRemoteBranches.filter((branch) => {
          return !excludePatterns.some((pattern) => {
            const regex = new RegExp(
              "^" + pattern.replace(/\*/g, ".*") + "$"
            );
            return regex.test(branch);
          });
        });
        
        log("Panel", `Checking ${branches.length} remote branches for activity`);
      } catch (err) {
        log("Panel", `Could not get remote branches: ${err}`);
        // Fall back to configured branches
        branches = this.config.scope?.branches || ["origin/main"];
      }

      // Limit to most recent branches to avoid overwhelming
      const maxBranches = 50;
      const branchesToCheck = branches.slice(0, maxBranches);

      for (const branch of branchesToCheck) {
        try {
          const commits = await this.git.log({
            branch,
            since,
            maxCount: 20, // Reduced per-branch to keep total manageable
          });

          // Group by author
          for (const commit of commits) {
            const key = commit.email;
            let activity = this.authorActivities.get(key);

            if (!activity) {
              activity = {
                name: commit.author,
                email: commit.email,
                lastActive: commit.date,
                branches: [],
                totalConflicts: 0,
              };
              this.authorActivities.set(key, activity);
            }

            // Update last active if more recent
            if (commit.date > activity.lastActive) {
              activity.lastActive = commit.date;
            }

            // Add branch if not already tracked
            let branchActivity = activity.branches.find(
              (b) => b.name === branch
            );
            if (!branchActivity) {
              branchActivity = {
                name: branch,
                lastCommit: commit,
                changedFiles: [],
                conflictingFiles: [],
                aheadBy: 0,
              };
              activity.branches.push(branchActivity);
            }

            // Get changed files for this commit
            try {
              const files = await this.git.getChangedFiles(commit.hash);
              for (const file of files) {
                if (!branchActivity.changedFiles.includes(file)) {
                  branchActivity.changedFiles.push(file);
                }
              }
            } catch {
              // Ignore errors getting changed files
            }
          }
        } catch (error) {
          log("Panel", `Error processing branch ${branch}: ${error}`);
        }
      }

      // Sort authors by last active (most recent first)
      const sorted = Array.from(this.authorActivities.entries()).sort(
        ([, a], [, b]) => b.lastActive.getTime() - a.lastActive.getTime()
      );
      this.authorActivities = new Map(sorted);
    } catch (error) {
      log("Panel", `Error updating author activities: ${error}`);
    }
  }

  /**
   * Parse time window to git-compatible format
   */
  private parseTimeWindow(window: string): string {
    const match = window.match(/^(\d+)([hdwm])$/);
    if (!match) return "14 days ago";

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
   * Get tree item for display
   */
  getTreeItem(element: ConflictPanelItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for tree hierarchy
   */
  async getChildren(element?: ConflictPanelItem): Promise<ConflictPanelItem[]> {
    if (!element) {
      // Root level - show sections
      return this.getRootItems();
    }

    // Return stored children
    return element.children || [];
  }

  /**
   * Get root level items (sections)
   */
  private getRootItems(): ConflictPanelItem[] {
    const items: ConflictPanelItem[] = [];

    // Section: Tracked Branches
    const trackedSection = this.createSectionItem(
      "Tracked Branches",
      `↩ ${this.trackedBranch}`,
      [this.createTrackedBranchItem()]
    );
    items.push(trackedSection);

    // Section: Your Branch
    const yourBranchSection = this.createSectionItem(
      "Your Branch",
      "Base branch ⇄ Your working tree",
      [this.createYourBranchItem()]
    );
    items.push(yourBranchSection);

    // Section: Team Activity
    const teamItems = this.createTeamItems();
    const teamSection = this.createSectionItem(
      "Team Activity",
      `${this.authorActivities.size} contributors`,
      teamItems
    );
    items.push(teamSection);

    return items;
  }

  /**
   * Create a section header item
   */
  private createSectionItem(
    label: string,
    description: string,
    children: ConflictPanelItem[]
  ): ConflictPanelItem {
    const item: ConflictPanelItem = {
      label,
      description,
      itemType: "section",
      collapsibleState:
        children.length > 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.None,
      children,
      iconPath: new vscode.ThemeIcon("folder"),
    };
    return item;
  }

  /**
   * Create tracked branch item
   */
  private createTrackedBranchItem(): ConflictPanelItem {
    const item: ConflictPanelItem = {
      label: this.trackedBranch,
      description:
        this.aheadBehind.behind > 0
          ? `↓ ${this.aheadBehind.behind} commits to pull`
          : "Up to date",
      itemType: "branch",
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      iconPath: new vscode.ThemeIcon("git-branch"),
      branch: this.trackedBranch,
    };
    return item;
  }

  /**
   * Create your branch item
   */
  private createYourBranchItem(): ConflictPanelItem {
    const item: ConflictPanelItem = {
      label: "Working Tree",
      description: "Your local changes",
      itemType: "branch",
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      iconPath: new vscode.ThemeIcon("git-commit"),
    };
    return item;
  }

  /**
   * Create team activity items
   */
  private createTeamItems(): ConflictPanelItem[] {
    const items: ConflictPanelItem[] = [];

    for (const [, activity] of this.authorActivities) {
      const timeAgo = this.formatTimeAgo(activity.lastActive);
      const hasConflicts = activity.totalConflicts > 0;

      // Create branch children
      const branchChildren: ConflictPanelItem[] = activity.branches.map(
        (branch) => {
          const fileChildren: ConflictPanelItem[] = branch.changedFiles.map((file) => {
              const isConflict = branch.conflictingFiles.includes(file);
              const absolutePath = path.join(this.workspacePath, file);
              return {
                label: file.split("/").pop() || file,
                description: file,
                itemType: "file" as TreeItemType,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon(
                  isConflict ? "warning" : "file"
                ),
                filePath: absolutePath,
                contextValue: isConflict ? "conflictFile" : "changedFile",
                // Open diff view instead of just opening the file
                command: {
                  command: "gitspectra.openFileDiff",
                  title: "View Diff",
                  arguments: [{ file: absolutePath, branch: branch.name }],
                },
              };
            });

          // No more slicing - show all files

          return {
            label: branch.name.replace("origin/", ""),
            description: `${branch.changedFiles.length} files`,
            itemType: "branch" as TreeItemType,
            collapsibleState:
              fileChildren.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon("git-branch"),
            children: fileChildren,
            branch: branch.name,
          };
        }
      );

      // Use Gravatar for author avatar
      const avatarUri = this.getGravatarUrl(activity.email, 32);

      const item: ConflictPanelItem = {
        label: activity.name,
        description: timeAgo,
        itemType: "author",
        collapsibleState:
          branchChildren.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        iconPath: avatarUri,
        children: branchChildren,
        author: activity.email,
        tooltip: new vscode.MarkdownString(
          `![avatar](${avatarUri.toString()}) **${activity.name}**\n\n` +
          `📧 ${activity.email}\n\n` +
          `🕐 Last active: ${timeAgo}\n\n` +
          `🌿 ${activity.branches.length} branch(es)\n\n` +
          (hasConflicts ? `⚠️ **Has conflicts with your files**` : "")
        ),
      };
      
      // Mark the tooltip as trusted to render images
      if (item.tooltip instanceof vscode.MarkdownString) {
        item.tooltip.isTrusted = true;
        item.tooltip.supportHtml = true;
      }

      items.push(item);
    }

    return items;
  }

  /**
   * Format date as relative time
   */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
    return `${Math.floor(seconds / 2592000)} months ago`;
  }

  /**
   * Update config
   */
  setConfig(config: GitSpectraConfig): void {
    this.config = config;
  }

  /**
   * Update git driver (when switching repos)
   */
  setGitDriver(git: GitDriver): void {
    this.git = git;
  }

  /**
   * Update workspace path (when switching repos)
   */
  setWorkspacePath(workspacePath: string): void {
    this.workspacePath = workspacePath;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

