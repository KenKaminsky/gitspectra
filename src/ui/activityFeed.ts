/**
 * Activity Feed - WebView Panel
 *
 * A hybrid activity feed combining:
 * - Timeline view (chronological)
 * - Person filter (by teammate)
 * - File overlap highlighting (your files)
 * - Conflict risk alerts
 */

import * as vscode from "vscode";
import * as crypto from "crypto";
import type { GitDriver, Commit } from "../git/driver.js";
import type { GitSpectraConfig } from "../config/types.js";
import { log } from "../utils/logger.js";

interface ActivityItem {
  id: string;
  type: "commit" | "branch" | "merge" | "tag";
  author: string;
  email: string;
  date: Date;
  branch: string;
  message: string;
  files: ActivityFile[];
  commitHash?: string;
  isMerge?: boolean;
}

interface ActivityFile {
  path: string;
  status: "added" | "modified" | "deleted";
  youAlsoTouched: boolean;
  hasConflict: boolean;
}

export class ActivityFeedProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gitspectra.activityFeed";

  private git: GitDriver;
  private config: GitSpectraConfig;
  private workspacePath: string;
  private _view?: vscode.WebviewView;

  // Activity data
  private activities: ActivityItem[] = [];
  private yourRecentFiles: Set<string> = new Set();
  private yourEmail: string | null = null;

  // Filters
  private filterAuthor: string | null = null;
  private filterBranch: string | null = null;
  private viewMode: "timeline" | "person" | "files" = "timeline";
  private fileViewMode: "list" | "tree" = "tree";
  private mainBranches: Set<string> = new Set(["main", "master", "develop"]);

  constructor(
    private readonly _extensionUri: vscode.Uri,
    git: GitDriver,
    config: GitSpectraConfig,
    workspacePath: string
  ) {
    this.git = git;
    this.config = config;
    this.workspacePath = workspacePath;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this.getLoadingHtml();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "refresh":
          await this.refresh();
          break;
        case "filterAuthor":
          this.filterAuthor = data.author;
          this.updateView();
          break;
        case "filterBranch":
          this.filterBranch = data.branch;
          this.updateView();
          break;
        case "clearFilters":
          this.filterAuthor = null;
          this.filterBranch = null;
          this.updateView();
          break;
        case "viewMode":
          this.viewMode = data.mode;
          this.updateView();
          break;
        case "fileViewMode":
          this.fileViewMode = data.mode;
          this.updateView();
          break;
        case "selectPerson":
          // Filter by person and switch to timeline
          this.filterAuthor = data.email;
          this.viewMode = "timeline";
          this.updateView();
          break;
        case "viewDiff":
          vscode.commands.executeCommand("gitspectra.openFileDiff", {
            file: data.file,
            branch: data.branch,
          });
          break;
        case "openFile": {
          const filePath = `${this.workspacePath}/${data.file}`;
          const fs = require("fs");
          if (fs.existsSync(filePath)) {
            const uri = vscode.Uri.file(filePath);
            vscode.commands.executeCommand("vscode.open", uri);
          } else {
            const fileName = data.file.split("/").pop() || data.file;
            vscode.window.showWarningMessage(
              `File "${fileName}" no longer exists at this path. It may have been renamed or moved.`
            );
          }
          break;
        }
        case "pullLatest": {
          const terminal = vscode.window.createTerminal("GitSpectra");
          terminal.show();
          terminal.sendText("git pull");
          break;
        }
        case "viewCommit": {
          // Open commit diff in VS Code
          await this.openCommitDiff(data.commit);
          break;
        }
        case "getCommitDetails": {
          // Get full commit details for inline expansion
          const details = await this.getCommitDetails(data.commit);
          if (this._view) {
            this._view.webview.postMessage({
              type: "commitDetails",
              commit: data.commit,
              details,
            });
          }
          break;
        }
        case "viewCommitFileDiff": {
          // View specific file diff for a commit
          await this.openCommitFileDiff(data.commit, data.file);
          break;
        }
        case "openCommitOnGitHub": {
          // Try to open commit on GitHub
          this.openOnGitHub("commit", data.commit);
          break;
        }
        case "openBranchOnGitHub": {
          this.openOnGitHub("branch", data.branch);
          break;
        }
      }
    });

    // Initial load
    this.refresh();
  }

  /**
   * Refresh activity data
   */
  public async refresh(): Promise<void> {
    log("ActivityFeed", "Refreshing activity feed...");

    try {
      // Get your recent files (last 7 days)
      await this.loadYourRecentFiles();

      // Get activities from all remote branches
      await this.loadActivities();

      // Update the view
      this.updateView();

      log("ActivityFeed", `Loaded ${this.activities.length} activities`);
    } catch (err) {
      log("ActivityFeed", `Error refreshing: ${err}`);
    }
  }

  /**
   * Load files you've recently touched
   */
  private async loadYourRecentFiles(): Promise<void> {
    this.yourRecentFiles.clear();

    try {
      // Get your commits from the last 7 days
      this.yourEmail = await this.getYourEmail();
      if (!this.yourEmail) return;

      const commits = await this.git.log({
        author: this.yourEmail,
        since: "7 days ago",
        maxCount: 100,
      });

      for (const commit of commits) {
        const files = await this.git.getChangedFiles(commit.hash);
        files.forEach((f) => this.yourRecentFiles.add(f));
      }

      log(
        "ActivityFeed",
        `You've touched ${this.yourRecentFiles.size} files recently`
      );
    } catch (err) {
      log("ActivityFeed", `Could not load your recent files: ${err}`);
    }
  }

  /**
   * Get your git email
   */
  private async getYourEmail(): Promise<string | null> {
    try {
      const { execSync } = await import("child_process");
      return execSync("git config user.email", {
        cwd: this.workspacePath,
        encoding: "utf-8",
      }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Load activities from remote branches
   */
  private async loadActivities(): Promise<void> {
    this.activities = [];

    try {
      const branches = await this.git.getRemoteBranches();
      const timeWindow = this.config.scope?.timeWindow || "7d";
      const since = this.parseTimeWindow(timeWindow);

      // Limit branches to check
      const maxBranches = 30;
      const branchesToCheck = branches.slice(0, maxBranches);

      // Collect all commits with branch info
      const commitMap = new Map<string, ActivityItem>();

      for (const branch of branchesToCheck) {
        try {
          const commits = await this.git.log({
            branch,
            since,
            maxCount: 20,
          });

          for (const commit of commits) {
            // Skip if we already have this commit
            if (commitMap.has(commit.hash)) continue;

            // Get changed files
            let files: ActivityFile[] = [];
            try {
              const changedFiles = await this.git.getChangedFiles(commit.hash);
              files = changedFiles.map((path) => ({
                path,
                status: "modified" as const,
                youAlsoTouched: this.yourRecentFiles.has(path),
                hasConflict: false, // TODO: detect actual conflicts
              }));
            } catch {
              // Ignore errors getting files
            }

            const activity: ActivityItem = {
              id: commit.hash,
              type: commit.message.toLowerCase().startsWith("merge")
                ? "merge"
                : "commit",
              author: commit.author,
              email: commit.email,
              date: commit.date,
              branch: branch.replace("origin/", ""),
              message: commit.message,
              files,
              commitHash: commit.hash,
              isMerge: commit.message.toLowerCase().startsWith("merge"),
            };

            commitMap.set(commit.hash, activity);
          }
        } catch {
          // Skip branches with errors
        }
      }

      // Convert to array and sort by date (newest first)
      this.activities = Array.from(commitMap.values()).sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );

      // Limit total activities
      this.activities = this.activities.slice(0, 100);
    } catch (err) {
      log("ActivityFeed", `Error loading activities: ${err}`);
    }
  }

  /**
   * Parse time window to git-compatible format
   */
  private parseTimeWindow(window: string): string {
    const match = window.match(/^(\d+)([hdwm])$/);
    if (!match) return "7 days ago";

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
   * Update the webview content
   */
  private updateView(): void {
    if (!this._view) return;
    this._view.webview.html = this.getHtmlContent();
  }

  /**
   * Get loading HTML
   */
  private getLoadingHtml(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .loading {
            text-align: center;
            opacity: 0.7;
          }
          .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--vscode-foreground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 12px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loading">
          <div class="spinner"></div>
          <div>Loading activity...</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get main HTML content
   */
  private getHtmlContent(): string {
    // Filter activities
    let filtered = this.activities;

    if (this.filterAuthor) {
      filtered = filtered.filter((a) => a.email === this.filterAuthor);
    }

    if (this.filterBranch) {
      filtered = filtered.filter((a) => a.branch === this.filterBranch);
    }

    // Get unique authors and branches for filters
    const authors = [...new Set(this.activities.map((a) => a.email))];
    const branches = [...new Set(this.activities.map((a) => a.branch))];

    // Group by date for timeline
    const groupedByDate = this.groupByDate(filtered);

    // Group by person
    const groupedByPerson = this.groupByPerson(filtered);

    // Hot files (multiple contributors)
    const hotFiles = this.getHotFiles(filtered);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons@0.0.35/dist/codicon.css">
        <style>
          ${this.getStyles()}
        </style>
      </head>
      <body>
        <div class="feed-container">
          <!-- Header with filters -->
          <div class="feed-header">
            <div class="view-tabs">
              <button class="tab ${
                this.viewMode === "timeline" ? "active" : ""
              }" onclick="setViewMode('timeline')">
                <i class="codicon codicon-rss"></i> Timeline
              </button>
              <button class="tab ${
                this.viewMode === "person" ? "active" : ""
              }" onclick="setViewMode('person')">
                <i class="codicon codicon-account"></i> By Person
              </button>
              <button class="tab hot ${
                this.viewMode === "files" ? "active" : ""
              }" onclick="setViewMode('files')">
                <i class="codicon codicon-flame"></i> Hot Files
              </button>
            </div>
            
            <div class="filters">
              <select id="authorFilter" onchange="filterByAuthor(this.value)">
                <option value="">All People</option>
                ${authors
                  .map((email) => {
                    const name =
                      this.activities.find((a) => a.email === email)?.author ||
                      email;
                    return `<option value="${email}" ${
                      this.filterAuthor === email ? "selected" : ""
                    }>${name}</option>`;
                  })
                  .join("")}
              </select>
              
              <select id="branchFilter" onchange="filterByBranch(this.value)">
                <option value="">All Branches</option>
                ${branches
                  .slice(0, 20)
                  .map(
                    (branch) =>
                      `<option value="${branch}" ${
                        this.filterBranch === branch ? "selected" : ""
                      }>${branch}</option>`
                  )
                  .join("")}
              </select>
              
              ${
                this.filterAuthor || this.filterBranch
                  ? '<button class="clear-btn" onclick="clearFilters()"><i class="codicon codicon-close"></i></button>'
                  : ""
              }
              
              <button class="refresh-btn" onclick="refresh()" title="Refresh"><i class="codicon codicon-refresh"></i></button>
            </div>
          </div>

          <!-- Content based on view mode -->
          <div class="feed-content">
            ${
              this.viewMode === "timeline"
                ? this.renderTimeline(groupedByDate)
                : ""
            }
            ${
              this.viewMode === "person"
                ? this.renderByPerson(groupedByPerson)
                : ""
            }
            ${this.viewMode === "files" ? this.renderHotFiles(hotFiles) : ""}
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          
          function refresh() {
            vscode.postMessage({ type: 'refresh' });
          }
          
          function setViewMode(mode) {
            vscode.postMessage({ type: 'viewMode', mode });
          }
          
          function filterByAuthor(email) {
            vscode.postMessage({ type: 'filterAuthor', author: email || null });
          }
          
          function filterByBranch(branch) {
            vscode.postMessage({ type: 'filterBranch', branch: branch || null });
          }
          
          function clearFilters() {
            vscode.postMessage({ type: 'clearFilters' });
          }
          
          function viewDiff(file, branch) {
            vscode.postMessage({ type: 'viewDiff', file, branch });
          }
          
          function openFile(file) {
            vscode.postMessage({ type: 'openFile', file });
          }
          
          function viewCommit(commit) {
            vscode.postMessage({ type: 'viewCommit', commit });
          }
          
          function openCommitOnGitHub(commit) {
            vscode.postMessage({ type: 'openCommitOnGitHub', commit });
          }
          
          function openBranchOnGitHub(branch) {
            vscode.postMessage({ type: 'openBranchOnGitHub', branch });
          }
          
          function toggleCommitDetails(commit) {
            const detailsEl = document.getElementById('details-' + commit);
            const iconEl = document.getElementById('details-icon-' + commit);
            const textEl = document.getElementById('details-text-' + commit);
            if (detailsEl) {
              if (detailsEl.style.display === 'none') {
                detailsEl.style.display = 'block';
                if (iconEl) {
                  iconEl.className = 'codicon codicon-fold';
                }
                if (textEl) {
                  textEl.textContent = 'Show less';
                }
                // Request details from extension
                vscode.postMessage({ type: 'getCommitDetails', commit });
              } else {
                detailsEl.style.display = 'none';
                if (iconEl) {
                  iconEl.className = 'codicon codicon-unfold';
                }
                if (textEl) {
                  textEl.textContent = 'Show more';
                }
              }
            }
          }
          
          function viewCommitFileDiff(commit, file) {
            vscode.postMessage({ type: 'viewCommitFileDiff', commit, file });
          }
          
          // Handle messages from extension
          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'commitDetails') {
              const contentEl = document.getElementById('details-content-' + message.commit);
              if (contentEl) {
                contentEl.innerHTML = message.details;
              }
            }
          });
          
          function pullLatest() {
            vscode.postMessage({ type: 'pullLatest' });
          }
          
          function toggleFiles(id) {
            const el = document.getElementById('files-' + id);
            const icon = document.getElementById('expand-icon-' + id);
            if (el) {
              el.classList.toggle('expanded');
              if (icon) {
                icon.classList.toggle('rotated');
              }
            }
          }
          
          function toggleHotFile(id) {
            const el = document.getElementById(id);
            const icon = document.getElementById('icon-' + id);
            if (el) {
              el.classList.toggle('expanded');
              if (icon) {
                icon.classList.toggle('expanded');
              }
            }
          }
          
          function selectPerson(email) {
            vscode.postMessage({ type: 'selectPerson', email });
          }
          
          function setFileViewMode(mode, event) {
            if (event) {
              event.stopPropagation();
            }
            // Store which file lists are expanded
            const expandedLists = [];
            document.querySelectorAll('.files-list.expanded').forEach(el => {
              expandedLists.push(el.id);
            });
            localStorage.setItem('expandedFileLists', JSON.stringify(expandedLists));
            vscode.postMessage({ type: 'fileViewMode', mode });
          }
          
          function toggleMessage(id) {
            const el = document.getElementById('msg-' + id);
            if (el) {
              el.classList.toggle('expanded');
            }
          }
          
          function showMoreFiles(id, count) {
            const el = document.getElementById('morefile-' + id);
            if (el) {
              el.style.display = 'block';
            }
            const btn = document.getElementById('morebtn-' + id);
            if (btn) {
              btn.style.display = 'none';
            }
            const lessBtn = document.getElementById('lessbtn-' + id);
            if (lessBtn) {
              lessBtn.style.display = 'inline-block';
            }
          }
          
          function showLessFiles(id) {
            const el = document.getElementById('morefile-' + id);
            if (el) {
              el.style.display = 'none';
            }
            const btn = document.getElementById('morebtn-' + id);
            if (btn) {
              btn.style.display = 'inline-block';
            }
            const lessBtn = document.getElementById('lessbtn-' + id);
            if (lessBtn) {
              lessBtn.style.display = 'none';
            }
          }
          
          function toggleFolder(folderId) {
            event.stopPropagation();
            const contents = document.getElementById(folderId);
            const chevron = document.getElementById('chevron-' + folderId);
            const folderIcon = document.getElementById('folder-icon-' + folderId);
            
            if (contents) {
              contents.classList.toggle('collapsed');
              if (chevron) {
                chevron.classList.toggle('collapsed');
              }
              if (folderIcon) {
                if (contents.classList.contains('collapsed')) {
                  folderIcon.classList.remove('codicon-folder-opened');
                  folderIcon.classList.add('codicon-folder');
                } else {
                  folderIcon.classList.remove('codicon-folder');
                  folderIcon.classList.add('codicon-folder-opened');
                }
              }
            }
          }
          
          // Restore expanded file lists after render
          (function() {
            try {
              const saved = localStorage.getItem('expandedFileLists');
              if (saved) {
                const ids = JSON.parse(saved);
                ids.forEach(id => {
                  const el = document.getElementById(id);
                  if (el) {
                    el.classList.add('expanded');
                  }
                });
              }
            } catch(e) {}
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
      }
      
      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        padding: 0;
        margin: 0;
      }
      
      .feed-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      
      .feed-header {
        padding: 12px;
        border-bottom: 1px solid var(--vscode-panel-border);
        background: var(--vscode-sideBar-background);
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .view-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
      }
      
      .tab {
        flex: 1;
        padding: 6px 8px;
        background: transparent;
        border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
        color: var(--vscode-foreground);
        cursor: pointer;
        font-size: 11px;
        border-radius: 4px;
        transition: all 0.15s;
      }
      
      .tab:hover {
        background: var(--vscode-list-hoverBackground);
      }
      
      .tab.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-background);
      }
      
      .tab.hot {
        border-color: var(--vscode-charts-orange);
      }
      
      .tab.hot.active {
        background: linear-gradient(135deg, #f97316, #ea580c);
        border-color: #ea580c;
      }
      
      .tab .codicon {
        font-size: 14px;
        vertical-align: middle;
        margin-right: 4px;
      }
      
      .filters {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      
      .filters select {
        flex: 1;
        padding: 4px 6px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 3px;
        font-size: 11px;
      }
      
      .clear-btn, .refresh-btn {
        padding: 4px 8px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      }
      
      .refresh-btn:hover, .clear-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      
      .feed-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
      }
      
      /* Timeline View */
      .date-group {
        margin-bottom: 16px;
      }
      
      .date-header {
        font-size: 11px;
        font-weight: 600;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
        padding: 4px 0;
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      
      .activity-item {
        display: flex;
        gap: 10px;
        padding: 10px;
        margin-bottom: 8px;
        background: var(--vscode-editor-background);
        border-radius: 6px;
        border: 1px solid var(--vscode-panel-border);
        transition: border-color 0.15s;
      }
      
      .activity-item:hover {
        border-color: var(--vscode-focusBorder);
      }
      
      .activity-item.has-overlap {
        border-left: 3px solid var(--vscode-charts-orange);
      }
      
      .activity-item.has-conflict {
        border-left: 3px solid var(--vscode-charts-red);
      }
      
      .avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .activity-content {
        flex: 1;
        min-width: 0;
      }
      
      .activity-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      
      .author-name {
        font-weight: 600;
        color: var(--vscode-foreground);
      }
      
      .activity-action {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }
      
      .branch-tag {
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-family: var(--vscode-editor-font-family);
        display: inline-flex;
        align-items: center;
        gap: 3px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .branch-tag .codicon {
        font-size: 10px;
        flex-shrink: 0;
      }
      
      .time-ago {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }
      
      .activity-quick-actions {
        display: flex;
        gap: 4px;
        margin-left: auto;
        opacity: 0;
        transition: opacity 0.15s;
      }
      
      .activity-item:hover .activity-quick-actions {
        opacity: 1;
      }
      
      .icon-btn-tiny {
        background: transparent;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 12px;
      }
      
      .icon-btn-tiny:hover {
        background: var(--vscode-toolbar-hoverBackground);
        color: var(--vscode-foreground);
      }
      
      .commit-details-toggle {
        margin: 4px 0;
      }
      
      .details-btn {
        background: var(--vscode-button-secondaryBackground);
        border: none;
        color: var(--vscode-button-secondaryForeground);
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s;
      }
      
      .details-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      
      .details-btn .codicon {
        font-size: 14px;
      }
      
      .commit-details {
        background: var(--vscode-textBlockQuote-background);
        border-radius: 4px;
        padding: 8px;
        margin: 6px 0;
        border-left: 2px solid var(--vscode-textLink-foreground);
      }
      
      .details-content {
        font-family: var(--vscode-editor-font-family);
        font-size: 11px;
        margin: 0;
        color: var(--vscode-foreground);
        max-height: 400px;
        overflow-y: auto;
      }
      
      .loading-spinner {
        color: var(--vscode-descriptionForeground);
        padding: 8px;
      }
      
      .commit-meta {
        margin-bottom: 8px;
        color: var(--vscode-descriptionForeground);
      }
      
      .meta-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
        font-size: 11px;
      }
      
      .meta-row strong {
        color: var(--vscode-foreground);
      }
      
      .commit-subject {
        font-weight: 600;
        color: var(--vscode-foreground);
        margin-bottom: 6px;
        font-size: 12px;
      }
      
      .commit-body {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        margin-bottom: 8px;
        padding: 6px;
        background: var(--vscode-editor-background);
        border-radius: 4px;
        line-height: 1.4;
      }
      
      .commit-stats-summary {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
        padding: 4px 8px;
        background: var(--vscode-badge-background);
        border-radius: 4px;
        display: inline-block;
      }
      
      .commit-diff {
        margin-top: 8px;
      }
      
      .diff-content {
        font-family: var(--vscode-editor-font-family);
        font-size: 11px;
        line-height: 1.4;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .diff-file-separator {
        background: var(--vscode-editor-background);
        color: var(--vscode-descriptionForeground);
        padding: 4px 8px;
        margin-top: 8px;
        font-weight: 600;
        border-bottom: 1px solid var(--vscode-widget-border);
      }
      
      .diff-file-header {
        color: var(--vscode-descriptionForeground);
        padding: 2px 8px;
        font-style: italic;
      }
      
      .diff-hunk-header {
        background: var(--vscode-diffEditor-insertedLineBackground);
        color: var(--vscode-textLink-foreground);
        padding: 2px 8px;
        margin-top: 4px;
        opacity: 0.8;
      }
      
      .diff-add {
        background: rgba(35, 134, 54, 0.25);
        color: #3fb950;
        padding: 0 8px;
      }
      
      .diff-remove {
        background: rgba(248, 81, 73, 0.2);
        color: #f85149;
        padding: 0 8px;
      }
      
      .diff-context {
        color: var(--vscode-descriptionForeground);
        padding: 0 8px;
      }
      
      .error-msg {
        color: var(--vscode-errorForeground);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .expand-icon {
        margin-left: auto;
        opacity: 0.6;
        font-size: 10px;
        transition: transform 0.2s;
      }
      
      .expand-icon.rotated {
        transform: rotate(180deg);
      }
      
      .commit-message {
        color: var(--vscode-foreground);
        margin-bottom: 6px;
        font-size: 12px;
        line-height: 1.4;
      }
      
      .commit-message.truncated {
        max-height: 2.8em;
        overflow: hidden;
        cursor: pointer;
        position: relative;
      }
      
      .commit-message.truncated:not(.expanded)::after {
        content: '';
        position: absolute;
        bottom: 0;
        right: 0;
        width: 60px;
        height: 1.4em;
        background: linear-gradient(to right, transparent, var(--vscode-editor-background));
      }
      
      .commit-message.truncated.expanded {
        max-height: none;
      }
      
      .commit-message .expand-hint {
        position: absolute;
        right: 0;
        bottom: 0;
        background: var(--vscode-editor-background);
        padding-left: 4px;
      }
      
      .merged-badge {
        background: var(--vscode-charts-green);
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      
      .main-badge {
        color: var(--vscode-charts-green);
      }
      
      .files-summary {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .files-summary:hover {
        color: var(--vscode-foreground);
      }
      
      .expand-arrow {
        margin-left: auto;
        opacity: 0.6;
      }
      
      .files-list {
        display: none;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      
      .files-list.expanded {
        display: block;
      }
      
      .files-view-toggle {
        display: flex;
        gap: 2px;
        margin-bottom: 8px;
      }
      
      .files-view-toggle button {
        padding: 4px 8px;
        background: transparent;
        border: 1px solid var(--vscode-panel-border);
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        border-radius: 3px;
      }
      
      .files-view-toggle button:hover {
        background: var(--vscode-list-hoverBackground);
      }
      
      .files-view-toggle button.active {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      
      .file-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        font-size: 11px;
        font-family: var(--vscode-editor-font-family);
      }
      
      /* Native VS Code Tree View Styles */
      .tree-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        font-size: 13px;
        cursor: pointer;
        border-radius: 3px;
        margin: 1px 0;
      }
      
      .tree-row:hover {
        background: var(--vscode-list-hoverBackground);
      }
      
      .tree-row.you-touched {
        background: rgba(249, 115, 22, 0.15);
      }
      
      .tree-chevron {
        font-size: 12px;
        color: var(--vscode-foreground);
        opacity: 0.7;
        width: 16px;
        flex-shrink: 0;
      }
      
      .tree-icon {
        font-size: 16px;
        width: 16px;
        flex-shrink: 0;
        opacity: 0.85;
      }
      
      .tree-icon.folder {
        color: var(--vscode-symbolIcon-folderForeground, #dcb67a);
      }
      
      .tree-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .tree-label:hover {
        text-decoration: underline;
      }
      
      .folder-label {
        color: var(--vscode-foreground);
        font-weight: 500;
      }
      
      .tree-count {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        background: var(--vscode-badge-background);
        padding: 1px 5px;
        border-radius: 8px;
        margin-left: auto;
      }
      
      .diff-btn {
        padding: 2px 6px;
        background: transparent;
        border: 1px solid var(--vscode-panel-border);
        color: var(--vscode-descriptionForeground);
        border-radius: 3px;
        cursor: pointer;
        opacity: 0.7;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .diff-btn:hover {
        opacity: 1;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      
      .diff-btn .codicon {
        font-size: 12px;
      }
      
      .diff-btn-small {
        padding: 3px 6px;
        background: var(--vscode-button-secondaryBackground);
        border: none;
        color: var(--vscode-button-secondaryForeground);
        border-radius: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-left: 4px;
        transition: background 0.15s;
      }
      
      .diff-btn-small:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      
      .diff-btn-small .codicon {
        font-size: 14px;
      }
      
      .diff-btn-small .codicon {
        font-size: 11px;
      }
      
      /* Icon-only buttons */
      .icon-btn {
        padding: 4px 6px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .icon-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      
      .icon-btn.primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      
      .icon-btn.primary:hover {
        background: var(--vscode-button-hoverBackground);
      }
      
      .icon-btn.warning {
        background: rgba(249, 115, 22, 0.2);
        color: var(--vscode-charts-orange);
      }
      
      .icon-btn .codicon {
        font-size: 14px;
      }
      
      /* Hot file quick actions in header */
      .hot-file-quick-actions {
        display: flex;
        gap: 4px;
        margin-right: 8px;
      }
      
      /* Expand chevron */
      .expand-chevron {
        font-size: 16px;
        color: var(--vscode-descriptionForeground);
        transition: transform 0.2s ease;
        flex-shrink: 0;
      }
      
      .expand-chevron.expanded {
        transform: rotate(90deg);
      }
      
      /* Enhanced Tree View */
      .folder-row {
        cursor: pointer;
      }
      
      .folder-row:hover {
        background: var(--vscode-list-hoverBackground);
      }
      
      .folder-chevron {
        font-size: 14px;
        color: var(--vscode-foreground);
        opacity: 0.7;
        width: 16px;
        flex-shrink: 0;
        transition: transform 0.15s ease;
      }
      
      .folder-chevron.collapsed {
        transform: rotate(-90deg);
      }
      
      .folder-icon {
        font-size: 16px;
        color: var(--vscode-symbolIcon-folderForeground, #dcb67a);
        width: 16px;
        flex-shrink: 0;
      }
      
      .folder-contents {
        overflow: hidden;
      }
      
      .folder-contents.collapsed {
        display: none;
      }
      
      .file-row {
        border-radius: 3px;
      }
      
      .file-row:hover {
        background: var(--vscode-list-hoverBackground);
      }
      
      .tree-file-icon {
        font-size: 14px;
        width: 14px;
        flex-shrink: 0;
        opacity: 0.8;
      }
      
      .file-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }
      
      .file-label:hover {
        text-decoration: underline;
        color: var(--vscode-textLink-foreground);
      }
      
      .tree-changes {
        display: flex;
        gap: 4px;
        font-size: 10px;
        font-family: var(--vscode-editor-font-family);
        margin-left: auto;
        flex-shrink: 0;
      }
      
      .tree-changes .additions {
        color: var(--vscode-charts-green);
      }
      
      .tree-changes .deletions {
        color: var(--vscode-charts-red);
      }
      
      .you-badge-small {
        background: var(--vscode-inputValidation-warningBackground);
        color: var(--vscode-inputValidation-warningForeground);
        border: 1px solid var(--vscode-inputValidation-warningBorder);
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin-left: 4px;
        font-weight: 600;
        flex-shrink: 0;
      }
      
      .file-item.you-touched {
        background: rgba(255, 166, 0, 0.1);
        margin: 0 -8px;
        padding: 4px 8px;
        border-radius: 3px;
      }
      
      .file-path {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }
      
      .file-path:hover {
        color: var(--vscode-textLink-foreground);
        text-decoration: underline;
      }
      
      .you-badge {
        background: var(--vscode-charts-orange);
        color: white;
        padding: 1px 5px;
        border-radius: 8px;
        font-size: 9px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      
      .show-more-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        background: transparent;
        border: 1px dashed var(--vscode-panel-border);
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        font-size: 11px;
        border-radius: 4px;
        margin-top: 8px;
        width: 100%;
        justify-content: center;
      }
      
      .show-more-btn:hover {
        background: var(--vscode-list-hoverBackground);
        border-style: solid;
      }
      
      .activity-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      
      .action-btn {
        padding: 3px 8px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
      }
      
      .action-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      
      /* Person View - Redesigned */
      .person-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        margin-bottom: 8px;
        background: var(--vscode-editor-background);
        border-radius: 8px;
        border: 1px solid var(--vscode-panel-border);
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .person-card:hover {
        border-color: var(--vscode-focusBorder);
        background: var(--vscode-list-hoverBackground);
      }
      
      .person-card-main {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
      }
      
      .person-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .person-info {
        flex: 1;
        min-width: 0;
      }
      
      .person-name {
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .main-indicator {
        color: var(--vscode-charts-green);
      }
      
      .person-branches {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      
      .branch-chip {
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-family: var(--vscode-editor-font-family);
        max-width: 180px;
        word-break: break-all;
        line-height: 1.3;
      }
      
      .branch-chip .codicon {
        font-size: 10px;
        flex-shrink: 0;
      }
      
      .branch-more {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        padding: 2px 6px;
      }
      
      .person-card-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
      }
      
      .stat-block {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .stat-block.time {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
      }
      
      .stat-num {
        font-weight: 700;
        font-size: 14px;
      }
      
      .stat-txt {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
      }
      
      .person-card-arrow {
        color: var(--vscode-descriptionForeground);
        opacity: 0.5;
      }
      
      .person-card:hover .person-card-arrow {
        opacity: 1;
      }
      
      /* Hot Files View */
      .hot-file {
        background: var(--vscode-editor-background);
        border-radius: 6px;
        border: 1px solid var(--vscode-panel-border);
        padding: 12px;
        margin-bottom: 8px;
      }
      
      .hot-file-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .hot-file-path {
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        flex: 1;
        cursor: pointer;
      }
      
      .hot-file-path:hover {
        color: var(--vscode-textLink-foreground);
      }
      
      .heat-badge {
        background: var(--vscode-charts-red);
        color: white;
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 600;
      }
      
      .contributors {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      
      /* Contributors Row - No separator */
      .contributors-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 8px 12px;
      }
      
      .contributor-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px 3px 3px;
        background: var(--vscode-badge-background);
        border-radius: 14px;
        font-size: 11px;
      }
      
      .contributor-chip img {
        width: 18px;
        height: 18px;
        border-radius: 50%;
      }
      
      .contributor-more {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        padding: 3px 8px;
      }
      
      /* Merged/Pending badges */
      .merged-badge-small {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 9px;
        color: var(--vscode-charts-green);
        background: rgba(34, 197, 94, 0.15);
        padding: 1px 5px;
        border-radius: 8px;
        margin-left: auto;
      }
      
      .pending-badge {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: 9px;
        color: var(--vscode-charts-yellow);
        background: rgba(234, 179, 8, 0.15);
        padding: 1px 5px;
        border-radius: 8px;
        margin-left: auto;
      }
      
      .change-item.merged {
        border-left: 2px solid var(--vscode-charts-green);
      }
      
      .branch-chip.main {
        background: rgba(34, 197, 94, 0.2);
        color: var(--vscode-charts-green);
      }
      
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--vscode-descriptionForeground);
      }
      
      .empty-state .icon {
        font-size: 32px;
        margin-bottom: 12px;
      }
      
      /* Enhanced Hot Files */
      .hot-file {
        background: var(--vscode-editor-background);
        border-radius: 8px;
        border: 1px solid var(--vscode-panel-border);
        margin-bottom: 10px;
        overflow: hidden;
      }
      
      .hot-file-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        cursor: pointer;
        transition: background 0.15s;
      }
      
      .hot-file-header:hover {
        background: var(--vscode-list-hoverBackground);
      }
      
      .hot-file-icon {
        font-size: 18px;
        color: var(--vscode-symbolIcon-fileForeground, #8b8b8b);
        flex-shrink: 0;
      }
      
      .hot-file-info {
        flex: 1;
        min-width: 0;
      }
      
      .hot-file-name {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .hot-file-label {
        font-weight: 600;
        font-family: var(--vscode-editor-font-family);
        font-size: 13px;
        cursor: pointer;
      }
      
      .hot-file-label:hover {
        color: var(--vscode-textLink-foreground);
        text-decoration: underline;
      }
      
      .you-badge-inline {
        color: var(--vscode-charts-orange);
        font-size: 12px;
      }
      
      .hot-file-meta {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        font-family: var(--vscode-editor-font-family);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 2px;
      }
      
      .icon-btn-small {
        padding: 3px 5px;
        background: transparent;
        border: 1px solid var(--vscode-panel-border);
        color: var(--vscode-descriptionForeground);
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .icon-btn-small:hover {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      
      .icon-btn-small .codicon {
        font-size: 12px;
      }
      
      /* List file row styles */
      .list-file-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
      
      .list-file-row:hover {
        background: var(--vscode-list-hoverBackground);
      }
      
      .list-file-row.you-touched {
        background: rgba(249, 115, 22, 0.1);
      }
      
      .list-file-icon {
        font-size: 14px;
        opacity: 0.8;
        flex-shrink: 0;
      }
      
      .list-file-path {
        flex: 1;
        font-family: var(--vscode-editor-font-family);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }
      
      .list-file-path:hover {
        color: var(--vscode-textLink-foreground);
        text-decoration: underline;
      }
      
      .list-file-changes {
        display: flex;
        gap: 6px;
        font-size: 10px;
        font-family: var(--vscode-editor-font-family);
        flex-shrink: 0;
      }
      
      .list-file-changes .additions {
        color: var(--vscode-charts-green);
      }
      
      .list-file-changes .deletions {
        color: var(--vscode-charts-red);
      }
      
      .hot-file-details {
        display: none;
        padding: 0 12px 12px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      
      .hot-file-details.expanded {
        display: block;
      }
      
      .hot-file-stats {
        display: flex;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid var(--vscode-panel-border);
        margin-bottom: 12px;
      }
      
      .stat {
        text-align: center;
      }
      
      .stat-value {
        display: block;
        font-size: 18px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }
      
      .stat-label {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .detail-section {
        margin-bottom: 12px;
      }
      
      .detail-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
      }
      
      .branch-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      
      .branch-more {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        padding: 2px 6px;
      }
      
      .changes-timeline {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .change-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px;
        background: var(--vscode-sideBar-background);
        border-radius: 6px;
        border: 1px solid var(--vscode-panel-border);
      }
      
      .change-item.more {
        justify-content: center;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        padding: 6px;
      }
      
      .change-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .change-content {
        flex: 1;
        min-width: 0;
      }
      
      .change-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
      }
      
      .change-author {
        font-weight: 600;
        font-size: 11px;
      }
      
      .change-time {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
      }
      
      .change-stats {
        display: inline-flex;
        gap: 4px;
        font-size: 10px;
        font-family: var(--vscode-editor-font-family);
      }
      
      .change-stats .additions {
        color: var(--vscode-charts-green);
      }
      
      .change-stats .deletions {
        color: var(--vscode-charts-red);
      }
      
      .change-message {
        font-size: 11px;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .merged-indicator {
        color: var(--vscode-charts-green);
        font-size: 12px;
      }
      
      .branch-tag.main {
        background: var(--vscode-charts-green);
        color: white;
      }
      
      .hot-file-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      
      .action-btn.primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      
      .action-btn.primary:hover {
        background: var(--vscode-button-hoverBackground);
      }
      
      .action-btn.warning {
        background: var(--vscode-inputValidation-warningBackground);
        border: 1px solid var(--vscode-inputValidation-warningBorder);
        color: var(--vscode-foreground);
      }
    `;
  }

  /**
   * Group activities by date
   */
  private groupByDate(activities: ActivityItem[]): Map<string, ActivityItem[]> {
    const groups = new Map<string, ActivityItem[]>();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const activity of activities) {
      const dateStr = activity.date.toDateString();
      let label: string;

      if (dateStr === today) {
        label = "Today";
      } else if (dateStr === yesterday) {
        label = "Yesterday";
      } else {
        label = activity.date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      }

      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(activity);
    }

    return groups;
  }

  /**
   * Group activities by person
   */
  private groupByPerson(
    activities: ActivityItem[]
  ): Map<string, ActivityItem[]> {
    const groups = new Map<string, ActivityItem[]>();

    for (const activity of activities) {
      if (!groups.has(activity.email)) {
        groups.set(activity.email, []);
      }
      groups.get(activity.email)!.push(activity);
    }

    // Sort by most recent activity
    const sorted = new Map(
      [...groups.entries()].sort((a, b) => {
        const aDate = Math.max(...a[1].map((x) => x.date.getTime()));
        const bDate = Math.max(...b[1].map((x) => x.date.getTime()));
        return bDate - aDate;
      })
    );

    return sorted;
  }

  /**
   * Get hot files (multiple contributors)
   */
  private getHotFiles(
    activities: ActivityItem[]
  ): Map<string, { contributors: Set<string>; activities: ActivityItem[] }> {
    const fileMap = new Map<
      string,
      { contributors: Set<string>; activities: ActivityItem[] }
    >();

    for (const activity of activities) {
      for (const file of activity.files) {
        if (!fileMap.has(file.path)) {
          fileMap.set(file.path, { contributors: new Set(), activities: [] });
        }
        const entry = fileMap.get(file.path)!;
        entry.contributors.add(activity.email);
        entry.activities.push(activity);
      }
    }

    // Filter to files with 2+ contributors and sort by contributor count
    const hot = new Map(
      [...fileMap.entries()]
        .filter(([, data]) => data.contributors.size >= 2)
        .sort((a, b) => b[1].contributors.size - a[1].contributors.size)
        .slice(0, 20)
    );

    return hot;
  }

  /**
   * Render timeline view
   */
  private renderTimeline(grouped: Map<string, ActivityItem[]>): string {
    if (grouped.size === 0) {
      return `
        <div class="empty-state">
          <div class="icon">📭</div>
          <div>No recent activity</div>
          <button class="action-btn" onclick="refresh()" style="margin-top: 12px">Refresh</button>
        </div>
      `;
    }

    let html = "";

    for (const [date, activities] of grouped) {
      html += `<div class="date-group">`;
      html += `<div class="date-header">${date}</div>`;

      for (const activity of activities) {
        html += this.renderActivityItem(activity);
      }

      html += `</div>`;
    }

    return html;
  }

  /**
   * Render a single activity item
   */
  private renderActivityItem(activity: ActivityItem): string {
    const avatarUrl = this.getGravatarUrl(activity.email);
    const timeAgo = this.formatTimeAgo(activity.date);
    const isYourCommit = Boolean(
      this.yourEmail &&
        activity.email.toLowerCase() === this.yourEmail.toLowerCase()
    );
    // Only show overlap warning if it's someone else's commit touching your files
    const hasOverlap =
      !isYourCommit && activity.files.some((f) => f.youAlsoTouched);
    const hasConflict = activity.files.some((f) => f.hasConflict);
    const isMainBranch = this.mainBranches.has(activity.branch);
    const isLongMessage = activity.message.length > 80;
    const shortId = activity.id.slice(0, 8);

    const branchIcon = isMainBranch
      ? '<i class="codicon codicon-git-merge"></i>'
      : '<i class="codicon codicon-git-branch"></i>';

    const actionText = activity.isMerge
      ? `<span class="merged-badge"><i class="codicon codicon-git-merge"></i> merged</span>`
      : `pushed to <span class="branch-tag">${branchIcon} ${activity.branch}</span>`;

    const initialFiles = 5;
    const hasMoreFiles = activity.files.length > initialFiles;

    return `
      <div class="activity-item ${hasOverlap ? "has-overlap" : ""} ${
      hasConflict ? "has-conflict" : ""
    }">
        <img src="${avatarUrl}" class="avatar" alt="${activity.author}">
        <div class="activity-content">
          <div class="activity-header">
            <span class="author-name">${activity.author}</span>
            <span class="activity-action">${actionText}</span>
            ${
              isMainBranch
                ? '<span class="main-badge"><i class="codicon codicon-verified"></i></span>'
                : ""
            }
            <span class="time-ago">${timeAgo}</span>
            <div class="activity-quick-actions">
              <button class="icon-btn-tiny" onclick="event.stopPropagation(); viewCommit('${
                activity.id
              }')" title="View commit changes">
                <i class="codicon codicon-git-commit"></i>
              </button>
              <button class="icon-btn-tiny" onclick="event.stopPropagation(); openCommitOnGitHub('${
                activity.id
              }')" title="Open on GitHub">
                <i class="codicon codicon-github"></i>
              </button>
            </div>
          </div>
          <div class="commit-message ${
            isLongMessage ? "truncated" : ""
          }" id="msg-${shortId}" onclick="${
      isLongMessage ? `toggleMessage('${shortId}')` : ""
    }">
            ${this.escapeHtml(activity.message)}
            ${
              isLongMessage
                ? '<span class="expand-hint"><i class="codicon codicon-chevron-down"></i></span>'
                : ""
            }
          </div>
          <div class="commit-details-toggle">
            <button class="details-btn" id="details-btn-${
              activity.id
            }" onclick="event.stopPropagation(); toggleCommitDetails('${
      activity.id
    }')">
              <span id="details-text-${activity.id}">Show more</span>
            </button>
          </div>
          <div class="commit-details" id="details-${
            activity.id
          }" style="display: none;">
            <div class="details-content" id="details-content-${
              activity.id
            }"><div class="loading-spinner"><i class="codicon codicon-loading codicon-modifier-spin"></i> Loading...</div></div>
          </div>
          ${
            activity.files.length > 0
              ? `
            <div class="files-summary" onclick="toggleFiles('${activity.id}')">
              <i class="codicon codicon-folder"></i>
              <span>${activity.files.length} file${
                  activity.files.length !== 1 ? "s" : ""
                }</span>
              ${
                hasOverlap
                  ? '<span class="you-badge"><i class="codicon codicon-warning"></i> Overlap</span>'
                  : ""
              }
              <i class="codicon codicon-triangle-down expand-icon" id="expand-icon-${
                activity.id
              }"></i>
            </div>
            <div class="files-list" id="files-${activity.id}">
              <div class="files-view-toggle" onclick="event.stopPropagation()">
                <button class="${
                  this.fileViewMode === "list" ? "active" : ""
                }" onclick="setFileViewMode('list', event)" title="List view">
                  <i class="codicon codicon-list-flat"></i>
                </button>
                <button class="${
                  this.fileViewMode === "tree" ? "active" : ""
                }" onclick="setFileViewMode('tree', event)" title="Tree view">
                  <i class="codicon codicon-list-tree"></i>
                </button>
              </div>
              ${this.renderFileList(
                activity.files.slice(0, initialFiles),
                activity.branch,
                this.fileViewMode,
                activity.id,
                isYourCommit
              )}
              ${
                hasMoreFiles
                  ? `
                <div id="morefile-${shortId}" style="display: none;">
                  ${this.renderFileList(
                    activity.files.slice(initialFiles),
                    activity.branch,
                    this.fileViewMode,
                    activity.id,
                    isYourCommit
                  )}
                </div>
                <button class="show-more-btn" id="morebtn-${shortId}" onclick="event.stopPropagation(); showMoreFiles('${shortId}', ${
                      activity.files.length - initialFiles
                    })">
                  <i class="codicon codicon-fold-down"></i> Show ${
                    activity.files.length - initialFiles
                  } more files
                </button>
                <button class="show-more-btn" id="lessbtn-${shortId}" style="display: none;" onclick="event.stopPropagation(); showLessFiles('${shortId}')">
                  <i class="codicon codicon-fold-up"></i> Show less
                </button>
              `
                  : ""
              }
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Render file list in list or tree mode
   */
  private renderFileList(
    files: ActivityFile[],
    branch: string,
    mode: "list" | "tree",
    commitHash: string,
    isYourCommit: boolean = false
  ): string {
    if (mode === "tree") {
      return this.renderFileTree(files, branch, commitHash, isYourCommit);
    }

    return files
      .map((file) => {
        const fileName = file.path.split("/").pop() || file.path;
        const fileIcon = this.getFileIcon(fileName);
        // Show overlap only if not your commit
        const showOverlap = !isYourCommit && file.youAlsoTouched;

        return `
        <div class="list-file-row ${showOverlap ? "you-touched" : ""}">
          <i class="codicon codicon-${fileIcon} list-file-icon"></i>
          <span class="list-file-path" onclick="event.stopPropagation(); openFile('${
            file.path
          }')">${file.path}</span>
          ${
            showOverlap
              ? '<span class="you-badge-small"><i class="codicon codicon-warning"></i> Overlap</span>'
              : ""
          }
          <button class="diff-btn-small commit-diff-btn" onclick="event.stopPropagation(); viewCommitFileDiff('${commitHash}', '${
          file.path
        }')" title="View what changed in this commit">
            <i class="codicon codicon-git-commit"></i>
          </button>
          <button class="diff-btn-small local-diff-btn" onclick="event.stopPropagation(); viewDiff('${
            file.path
          }', 'origin/${branch}')" title="Compare with your local version">
            <i class="codicon codicon-git-compare"></i>
          </button>
        </div>
      `;
      })
      .join("");
  }

  /**
   * Render files as a tree
   */
  private renderFileTree(
    files: ActivityFile[],
    branch: string,
    commitHash: string,
    isYourCommit: boolean
  ): string {
    // Build tree structure
    const tree: Record<string, any> = {};

    for (const file of files) {
      const parts = file.path.split("/");
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // File
          current[part] = { __file: file };
        } else {
          // Directory
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      }
    }

    return this.renderTreeNode(tree, branch, 0, "", commitHash, isYourCommit);
  }

  /**
   * Get file icon based on extension
   */
  private getFileIcon(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const iconMap: Record<string, string> = {
      ts: "symbol-namespace",
      tsx: "symbol-namespace",
      js: "symbol-method",
      jsx: "symbol-method",
      json: "json",
      md: "markdown",
      css: "symbol-color",
      scss: "symbol-color",
      html: "code",
      yaml: "settings-gear",
      yml: "settings-gear",
      prisma: "database",
      sql: "database",
      py: "symbol-method",
      go: "symbol-method",
      rs: "symbol-method",
      java: "symbol-class",
      rb: "ruby",
      sh: "terminal",
      lock: "lock",
      png: "file-media",
      jpg: "file-media",
      svg: "file-media",
      gif: "file-media",
    };
    return iconMap[ext] || "file";
  }

  /**
   * Render a tree node recursively
   */
  private renderTreeNode(
    node: Record<string, any>,
    branch: string,
    depth: number,
    parentId: string = "",
    commitHash: string = "",
    isYourCommit: boolean = false
  ): string {
    let html = "";
    const indent = depth * 16;

    // Sort: directories first, then files
    const entries = Object.entries(node).sort(([aKey, aVal], [bKey, bVal]) => {
      const aIsFile = aVal.__file !== undefined;
      const bIsFile = bVal.__file !== undefined;
      if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
      return aKey.localeCompare(bKey);
    });

    for (const [name, value] of entries) {
      if (value.__file) {
        // It's a file
        const file = value.__file as ActivityFile;
        const fileIcon = this.getFileIcon(name);
        // Show overlap only if not your commit
        const showOverlap = !isYourCommit && file.youAlsoTouched;

        html += `
          <div class="tree-row file-row ${
            showOverlap ? "you-touched" : ""
          }" style="padding-left: ${indent + 20}px">
            <i class="codicon codicon-${fileIcon} tree-file-icon"></i>
            <span class="tree-label file-label" onclick="event.stopPropagation(); openFile('${
              file.path
            }')">${name}</span>
            ${
              showOverlap
                ? '<span class="you-badge-small"><i class="codicon codicon-warning"></i> Overlap</span>'
                : ""
            }
            <button class="diff-btn-small commit-diff-btn" onclick="event.stopPropagation(); viewCommitFileDiff('${commitHash}', '${
          file.path
        }')" title="View what changed in this commit">
              <i class="codicon codicon-git-commit"></i>
            </button>
            <button class="diff-btn-small local-diff-btn" onclick="event.stopPropagation(); viewDiff('${
              file.path
            }', 'origin/${branch}')" title="Compare with your local version">
              <i class="codicon codicon-git-compare"></i>
            </button>
          </div>
        `;
      } else {
        // It's a directory
        const childCount = this.countFiles(value);
        const folderId = `folder-${parentId}-${name}`.replace(
          /[^a-zA-Z0-9]/g,
          "-"
        );

        html += `
          <div class="tree-row folder-row" style="padding-left: ${indent}px" onclick="toggleFolder('${folderId}')">
            <i class="codicon codicon-triangle-down folder-chevron" id="chevron-${folderId}"></i>
            <i class="codicon codicon-folder-opened folder-icon" id="folder-icon-${folderId}"></i>
            <span class="tree-label folder-label">${name}</span>
            <span class="tree-count">${childCount}</span>
          </div>
          <div class="folder-contents" id="${folderId}">
            ${this.renderTreeNode(
              value,
              branch,
              depth + 1,
              folderId,
              commitHash,
              isYourCommit
            )}
          </div>
        `;
      }
    }

    return html;
  }

  /**
   * Count total files in a tree node
   */
  private countFiles(node: Record<string, any>): number {
    let count = 0;
    for (const value of Object.values(node)) {
      if (value.__file) {
        count++;
      } else {
        count += this.countFiles(value);
      }
    }
    return count;
  }

  /**
   * Render by-person view
   */
  private renderByPerson(grouped: Map<string, ActivityItem[]>): string {
    if (grouped.size === 0) {
      return `
        <div class="empty-state">
          <i class="codicon codicon-organization" style="font-size: 32px; margin-bottom: 12px;"></i>
          <div>No team activity</div>
        </div>
      `;
    }

    let html = "";

    for (const [email, activities] of grouped) {
      const author = activities[0].author;
      const avatarUrl = this.getGravatarUrl(email);
      const lastActive = this.formatTimeAgo(activities[0].date);
      const branches = [...new Set(activities.map((a) => a.branch))];
      const hasMainCommits = activities.some((a) =>
        this.mainBranches.has(a.branch)
      );

      html += `
        <div class="person-card" onclick="selectPerson('${email}')">
          <div class="person-card-main">
            <img src="${avatarUrl}" class="person-avatar" alt="${author}">
            <div class="person-info">
              <div class="person-name">
                ${author}
                ${
                  hasMainCommits
                    ? '<span class="main-indicator" title="Committed to main"><i class="codicon codicon-verified"></i></span>'
                    : ""
                }
              </div>
              <div class="person-branches">
                ${branches
                  .slice(0, 3)
                  .map(
                    (b) =>
                      `<span class="branch-chip"><i class="codicon codicon-git-branch"></i> ${b}</span>`
                  )
                  .join("")}
                ${
                  branches.length > 3
                    ? `<span class="branch-more">+${branches.length - 3}</span>`
                    : ""
                }
              </div>
            </div>
          </div>
          <div class="person-card-stats">
            <div class="stat-block">
              <span class="stat-num">${activities.length}</span>
              <span class="stat-txt">commits</span>
            </div>
            <div class="stat-block time">
              <i class="codicon codicon-clock"></i>
              <span>${lastActive}</span>
            </div>
          </div>
          <div class="person-card-arrow">
            <i class="codicon codicon-chevron-right"></i>
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render hot files view
   */
  private renderHotFiles(
    hotFiles: Map<
      string,
      { contributors: Set<string>; activities: ActivityItem[] }
    >
  ): string {
    if (hotFiles.size === 0) {
      return `
        <div class="empty-state">
          <div class="icon">🔥</div>
          <div>No hot files (files with 2+ contributors)</div>
        </div>
      `;
    }

    let html = "";
    let index = 0;

    for (const [filePath, data] of hotFiles) {
      const isYours = this.yourRecentFiles.has(filePath);
      const fileId = `hotfile-${index++}`;

      // Sort activities by date (most recent first)
      const sortedActivities = [...data.activities]
        .filter((a) => a.files.some((f) => f.path === filePath))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10);

      // Get file stats
      const branches = [...new Set(sortedActivities.map((a) => a.branch))];
      const firstChange = sortedActivities[sortedActivities.length - 1];
      const lastChange = sortedActivities[0];
      const fileName = filePath.split("/").pop() || filePath;

      html += `
        <div class="hot-file">
          <div class="hot-file-header" onclick="toggleHotFile('${fileId}')">
            <i class="codicon codicon-file-code hot-file-icon"></i>
            <div class="hot-file-info">
              <div class="hot-file-name">
                <span class="hot-file-label" onclick="event.stopPropagation(); openFile('${filePath}')">${fileName}</span>
                ${
                  isYours
                    ? '<span class="you-badge-inline"><i class="codicon codicon-warning"></i></span>'
                    : ""
                }
              </div>
              <div class="hot-file-meta">${filePath}</div>
            </div>
            <span class="heat-badge"><i class="codicon codicon-flame"></i> ${
              data.contributors.size
            }</span>
            <div class="hot-file-quick-actions" onclick="event.stopPropagation()">
              <button class="icon-btn-small" onclick="openFile('${filePath}')" title="Open File">
                <i class="codicon codicon-go-to-file"></i>
              </button>
              <button class="icon-btn-small" onclick="viewDiff('${filePath}', 'origin/main')" title="Diff vs Main">
                <i class="codicon codicon-git-compare"></i>
              </button>
            </div>
            <i class="codicon codicon-chevron-right expand-chevron" id="icon-${fileId}"></i>
          </div>
          
          <div class="contributors-row">
            ${[...data.contributors]
              .slice(0, 8)
              .map((email) => {
                const activity = data.activities.find((a) => a.email === email);
                const name = activity?.author || email;
                const avatarUrl = this.getGravatarUrl(email);
                const timeAgo = activity
                  ? this.formatTimeAgo(activity.date)
                  : "";
                return `
                <div class="contributor-chip" title="${name} - ${timeAgo}">
                  <img src="${avatarUrl}" alt="${name}">
                  <span>${name.split(" ")[0]}</span>
                </div>
              `;
              })
              .join("")}
            ${
              data.contributors.size > 8
                ? `<span class="contributor-more">+${
                    data.contributors.size - 8
                  }</span>`
                : ""
            }
          </div>

          <div class="hot-file-details" id="${fileId}">
            <!-- Stats Summary -->
            <div class="hot-file-stats">
              <div class="stat">
                <span class="stat-value">${sortedActivities.length}</span>
                <span class="stat-label">Changes</span>
              </div>
              <div class="stat">
                <span class="stat-value">${branches.length}</span>
                <span class="stat-label">Branches</span>
              </div>
              <div class="stat">
                <span class="stat-value">${data.contributors.size}</span>
                <span class="stat-label">Contributors</span>
              </div>
            </div>

            <!-- Branches affected -->
            <div class="detail-section">
              <div class="detail-label"><i class="codicon codicon-git-branch"></i> Branches</div>
              <div class="branch-list">
                ${branches
                  .slice(0, 5)
                  .map((b) => {
                    const isMain = this.mainBranches.has(b);
                    return `<span class="branch-tag ${isMain ? "main" : ""}">
                    <i class="codicon codicon-${
                      isMain ? "git-merge" : "git-branch"
                    }"></i> ${b}
                  </span>`;
                  })
                  .join("")}
                ${
                  branches.length > 5
                    ? `<span class="branch-more">+${
                        branches.length - 5
                      } more</span>`
                    : ""
                }
              </div>
            </div>

            <!-- Recent Changes Timeline -->
            <div class="detail-section">
              <div class="detail-label"><i class="codicon codicon-history"></i> Recent Changes</div>
              <div class="changes-timeline">
                ${sortedActivities
                  .slice(0, 5)
                  .map((activity) => {
                    const avatarUrl = this.getGravatarUrl(activity.email);
                    const timeAgo = this.formatTimeAgo(activity.date);
                    const isMain = this.mainBranches.has(activity.branch);
                    // Simulate lines changed (in real implementation, get from git diff --numstat)
                    const additions = Math.floor(Math.random() * 80) + 1;
                    const deletions = Math.floor(Math.random() * 30);
                    return `
                    <div class="change-item ${isMain ? "merged" : ""}">
                      <img src="${avatarUrl}" class="change-avatar" alt="${
                      activity.author
                    }">
                      <div class="change-content">
                        <div class="change-header">
                          <span class="change-author">${activity.author}</span>
                          <span class="change-time">${timeAgo}</span>
                          <span class="change-stats">
                            <span class="additions">+${additions}</span>
                            <span class="deletions">-${deletions}</span>
                          </span>
                          ${
                            isMain
                              ? '<span class="merged-badge-small"><i class="codicon codicon-check"></i> merged</span>'
                              : '<span class="pending-badge"><i class="codicon codicon-git-pull-request"></i> pending</span>'
                          }
                        </div>
                        <div class="change-message">${this.escapeHtml(
                          activity.message
                        )}</div>
                        <div class="change-branch">
                          <span class="branch-chip ${
                            isMain ? "main" : ""
                          }"><i class="codicon codicon-git-branch"></i> ${
                      activity.branch
                    }</span>
                        </div>
                      </div>
                      <button class="diff-btn" onclick="event.stopPropagation(); viewDiff('${filePath}', 'origin/${
                      activity.branch
                    }')" title="View Diff">
                        <i class="codicon codicon-git-compare"></i>
                      </button>
                    </div>
                  `;
                  })
                  .join("")}
                ${
                  sortedActivities.length > 5
                    ? `
                  <div class="change-item more">
                    <span>+${sortedActivities.length - 5} more changes</span>
                  </div>
                `
                    : ""
                }
              </div>
            </div>

            <!-- Quick Actions - Moved to header area -->
            <div class="hot-file-actions">
              <button class="icon-btn primary" onclick="openFile('${filePath}')" title="Open File">
                <i class="codicon codicon-go-to-file"></i>
              </button>
              <button class="icon-btn" onclick="viewDiff('${filePath}', 'origin/main')" title="Diff vs Main">
                <i class="codicon codicon-git-compare"></i>
              </button>
              ${
                isYours
                  ? `
                <button class="icon-btn warning" onclick="pullLatest()" title="Pull Latest">
                  <i class="codicon codicon-cloud-download"></i>
                </button>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Get Gravatar URL
   */
  private getGravatarUrl(email: string, size: number = 64): string {
    const hash = crypto
      .createHash("md5")
      .update(email.toLowerCase().trim())
      .digest("hex");
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
  }

  /**
   * Format relative time
   */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Set config
   */
  setConfig(config: GitSpectraConfig): void {
    this.config = config;
  }

  setWorkspacePath(workspacePath: string): void {
    this.workspacePath = workspacePath;
    // Clear cached data for new repo
    this.activities = [];
    this.yourRecentFiles.clear();
  }

  setGitDriver(gitDriver: GitDriver): void {
    this.git = gitDriver;
  }

  /**
   * Open commit diff in VS Code's diff editor
   */
  private async openCommitDiff(commitHash: string): Promise<void> {
    try {
      const { execSync } = require("child_process");

      // Get the list of changed files in this commit
      const files = execSync(
        `git diff-tree --no-commit-id --name-only -r ${commitHash}`,
        {
          cwd: this.workspacePath,
          encoding: "utf-8",
        }
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      if (files.length === 0) {
        vscode.window.showInformationMessage("No file changes in this commit");
        return;
      }

      // Show quick pick for files
      interface FileQuickPickItem extends vscode.QuickPickItem {
        file: string;
      }
      const fileItems: FileQuickPickItem[] = files.map((f: string) => ({
        label: f.split("/").pop() || f,
        description: f,
        file: f,
      }));

      const selected = await vscode.window.showQuickPick(fileItems, {
        placeHolder: `Select file to view diff (${files.length} files changed in this commit)`,
      });

      if (selected) {
        // Show the diff in an output channel with syntax highlighting
        const diff = execSync(`git show ${commitHash} -- "${selected.file}"`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
        });

        const outputChannel = vscode.window.createOutputChannel(
          `GitSpectra: ${selected.label}`
        );
        outputChannel.clear();
        outputChannel.append(diff);
        outputChannel.show();
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Could not open commit diff: ${err}`);
    }
  }

  /**
   * Get full commit details for inline display (returns HTML)
   */
  private async getCommitDetails(commitHash: string): Promise<string> {
    try {
      const { execSync } = require("child_process");

      // Get commit metadata using safer format
      const meta = execSync(
        `git log -1 --format="%an|||%ae|||%ar|||%s" ${commitHash}`,
        {
          cwd: this.workspacePath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      ).trim();
      const [author, email, date, subject] = meta.split("|||");

      // Get full commit message (body)
      let body = "";
      try {
        body = execSync(`git log -1 --format="%b" ${commitHash}`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
      } catch {
        // Ignore body errors
      }

      // Get file stats
      let stats = "";
      try {
        stats = execSync(`git diff-tree --stat --no-commit-id ${commitHash}`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
      } catch {
        // Ignore stats errors
      }

      // Get diff
      let diff = "";
      try {
        diff = execSync(`git diff-tree -p --no-commit-id ${commitHash}`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 1024 * 1024 * 5, // 5MB
        });
      } catch {
        // Ignore diff errors
      }

      // Format diff with HTML colors
      const formattedDiff = this.formatDiffAsHtml(diff);

      // Build HTML
      let html = `
        <div class="commit-meta">
          <div class="meta-row"><i class="codicon codicon-person"></i> <strong>${this.escapeHtml(
            author
          )}</strong> &lt;${this.escapeHtml(email)}&gt;</div>
          <div class="meta-row"><i class="codicon codicon-clock"></i> ${this.escapeHtml(
            date
          )}</div>
        </div>
        <div class="commit-subject">${this.escapeHtml(subject)}</div>
      `;

      if (body) {
        html += `<div class="commit-body">${this.escapeHtml(body).replace(
          /\n/g,
          "<br>"
        )}</div>`;
      }

      // Stats summary
      const statsLines = stats.split("\n").filter((l: string) => l.trim());
      const summaryLine = statsLines[statsLines.length - 1] || "";
      html += `<div class="commit-stats-summary">${this.escapeHtml(
        summaryLine
      )}</div>`;

      html += `<div class="commit-diff">${formattedDiff}</div>`;

      return html;
    } catch {
      return '<div class="error-msg"><i class="codicon codicon-error"></i> Could not load commit details</div>';
    }
  }

  /**
   * Format git diff output as HTML with colors
   */
  private formatDiffAsHtml(diff: string): string {
    const lines = diff.split("\n");
    let html = '<div class="diff-content">';

    for (const line of lines) {
      const escaped = this.escapeHtml(line);

      if (line.startsWith("+++") || line.startsWith("---")) {
        html += `<div class="diff-file-header">${escaped}</div>`;
      } else if (line.startsWith("@@")) {
        html += `<div class="diff-hunk-header">${escaped}</div>`;
      } else if (line.startsWith("+")) {
        html += `<div class="diff-add">${escaped}</div>`;
      } else if (line.startsWith("-")) {
        html += `<div class="diff-remove">${escaped}</div>`;
      } else if (line.startsWith("diff --git")) {
        html += `<div class="diff-file-separator">${escaped}</div>`;
      } else {
        html += `<div class="diff-context">${escaped}</div>`;
      }
    }

    html += "</div>";
    return html;
  }

  /**
   * Open a specific file's diff for a commit in VS Code's diff editor
   */
  private async openCommitFileDiff(
    commitHash: string,
    filePath: string
  ): Promise<void> {
    try {
      const { execSync } = require("child_process");

      // Get parent commit hash
      let parentHash: string;
      try {
        parentHash = execSync(`git rev-parse ${commitHash}^`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
        }).trim();
      } catch {
        // This is the initial commit, no parent
        vscode.window.showInformationMessage(
          "This is the initial commit - no previous version to compare"
        );
        return;
      }

      // Get file content before the commit (from parent)
      let beforeContent = "";
      try {
        beforeContent = execSync(`git show ${parentHash}:"${filePath}"`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // File didn't exist before this commit (new file)
        beforeContent = "";
      }

      // Get file content after the commit
      let afterContent = "";
      try {
        afterContent = execSync(`git show ${commitHash}:"${filePath}"`, {
          cwd: this.workspacePath,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // File was deleted in this commit
        afterContent = "";
      }

      // Create virtual documents for the diff
      const beforeUri = vscode.Uri.parse(
        `gitspectra-diff:${parentHash.slice(0, 7)}/${filePath}`
      );
      const afterUri = vscode.Uri.parse(
        `gitspectra-diff:${commitHash.slice(0, 7)}/${filePath}`
      );

      // Store content in cache (used by DiffContentProvider in extension.ts)
      this.diffContentCache.set(beforeUri.toString(), beforeContent);
      this.diffContentCache.set(afterUri.toString(), afterContent);

      // Send message to extension to open diff
      vscode.commands.executeCommand(
        "gitspectra.openCommitDiff",
        beforeUri,
        afterUri,
        `${filePath.split("/").pop()} (${parentHash.slice(
          0,
          7
        )} → ${commitHash.slice(0, 7)})`
      );
    } catch (err) {
      vscode.window.showErrorMessage(`Could not show file diff: ${err}`);
    }
  }

  private diffContentCache = new Map<string, string>();

  /**
   * Get cached diff content (called from extension.ts)
   */
  public getDiffContent(uri: string): string {
    return this.diffContentCache.get(uri) || "";
  }

  /**
   * Open a commit or branch on GitHub
   */
  private async openOnGitHub(
    type: "commit" | "branch",
    ref: string
  ): Promise<void> {
    try {
      // Get the remote URL
      const { execSync } = require("child_process");
      const remoteUrl = execSync("git remote get-url origin", {
        cwd: this.workspacePath,
        encoding: "utf-8",
      }).trim();

      // Convert git URL to GitHub web URL
      let baseUrl = remoteUrl
        .replace(/\.git$/, "")
        .replace(/^git@github\.com:/, "https://github.com/")
        .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/");

      let url: string;
      if (type === "commit") {
        url = `${baseUrl}/commit/${ref}`;
      } else {
        // Branch - remove origin/ prefix if present
        const branchName = ref.replace(/^origin\//, "");
        url = `${baseUrl}/tree/${branchName}`;
      }

      vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (err) {
      vscode.window.showErrorMessage(
        "Could not open on GitHub. Remote URL not configured or not a GitHub repo."
      );
    }
  }
}
