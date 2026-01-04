/**
 * GitSpectra Extension
 *
 * See the full spectrum of your Git.
 * Local-only conflict detection for VS Code.
 * No cloud. No tracking. Just Git.
 */

import * as vscode from "vscode";
import { GitDriver } from "./git/driver.js";
import { ConflictDetector, FileConflictReport } from "./analyzer/conflictDetector.js";
import { ConfigLoader } from "./config/loader.js";
import { ConflictDecorationProvider } from "./ui/decorations.js";
import { ConflictFileDecorationProvider } from "./ui/fileDecorations.js";
import { StatusBarProvider } from "./ui/statusBar.js";
import { ConflictPanelProvider } from "./ui/conflictPanel.js";
import { ActivityFeedProvider } from "./ui/activityFeed.js";
import type { GitSpectraConfig } from "./config/types.js";
import { logger, log, warn, error, copyAllLogs, showLogs } from "./utils/logger.js";

let gitDriver: GitDriver;
let conflictDetector: ConflictDetector;
let configLoader: ConfigLoader;
let decorationProvider: ConflictDecorationProvider;
let fileDecorationProvider: ConflictFileDecorationProvider;
let statusBarProvider: StatusBarProvider;
let conflictPanelProvider: ConflictPanelProvider;
let activityFeedProvider: ActivityFeedProvider;

let fetchInterval: NodeJS.Timeout | null = null;
let isInitialized = false;
let workspaceRoot: string = "";
let deferredActivationDisposable: vscode.Disposable | null = null;

// Cache of conflict reports by file path
const conflictCache = new Map<string, FileConflictReport>();

/**
 * Find the git root directory, checking active file first, then workspace folders
 */
async function findGitRoot(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<string | null> {
  const { execSync } = await import("child_process");
  
  // Helper to check if a path is a git root
  const getGitRoot = (cwd: string): string | null => {
    try {
      const result = execSync("git rev-parse --show-toplevel", {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return result.trim();
    } catch {
      return null;
    }
  };

  // 1. Try active file's directory first
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.uri.scheme === "file") {
    const filePath = activeEditor.document.uri.fsPath;
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    const gitRoot = getGitRoot(dirPath);
    if (gitRoot) {
      log("Extension", `Found git repo from active file: ${gitRoot}`);
      return gitRoot;
    }
  }

  // 2. Try each workspace folder
  for (const folder of workspaceFolders) {
    const gitRoot = getGitRoot(folder.uri.fsPath);
    if (gitRoot) {
      log("Extension", `Found git repo in workspace folder: ${gitRoot}`);
      return gitRoot;
    }
  }

  return null;
}

/**
 * Get the git root for a specific file path (synchronous)
 */
function getGitRootForFile(filePath: string): string | null {
  const { execSync } = require("child_process");
  const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
  
  try {
    const result = execSync("git rev-parse --show-toplevel", {
      cwd: dirPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Switch GitSpectra to a different git repository
 */
async function switchToRepo(context: vscode.ExtensionContext, newRepoRoot: string): Promise<void> {
  log("Extension", `Switching GitSpectra context to: ${newRepoRoot}`);
  
  // Update the workspace root
  workspaceRoot = newRepoRoot;
  
  // Re-initialize git driver for new repo
  gitDriver = new GitDriver(workspaceRoot);
  
  // Re-initialize config loader for new repo (may have different .gitspectra.json)
  if (configLoader) {
    configLoader.dispose();
  }
  configLoader = new ConfigLoader(workspaceRoot);
  configLoader.initialize();
  
  const config = configLoader.getConfig();
  
  // Update existing providers with new config and repo
  if (conflictDetector) {
    conflictDetector = new ConflictDetector(gitDriver, config);
  }
  if (decorationProvider) {
    decorationProvider.setConfig(config);
  }
  if (statusBarProvider) {
    statusBarProvider.setConfig(config);
  }
  if (conflictPanelProvider) {
    conflictPanelProvider.setGitDriver(gitDriver);
    conflictPanelProvider.setWorkspacePath(workspaceRoot);
    conflictPanelProvider.setConfig(config);
    // Refresh to rebuild tree items with new paths
    conflictPanelProvider.refresh();
  }
  if (activityFeedProvider) {
    activityFeedProvider.setWorkspacePath(workspaceRoot);
    activityFeedProvider.setGitDriver(gitDriver);
    activityFeedProvider.setConfig(config);
    // Refresh with new repo data
    activityFeedProvider.refresh();
  }
  
  // Clear old conflict cache
  conflictCache.clear();
  if (fileDecorationProvider) {
    fileDecorationProvider.clearAll();
  }
  
  log("Extension", `Now tracking: ${workspaceRoot}`);
  
  // Refresh data for new repo
  await checkForConflicts();
}

/**
 * Setup listeners to detect when user opens a file in a git repo
 */
function setupDeferredActivation(context: vscode.ExtensionContext): void {
  log("Extension", "Setting up deferred activation - waiting for git repo file...");
  
  deferredActivationDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (!editor || editor.document.uri.scheme !== "file") return;
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    
    const gitRoot = await findGitRoot(workspaceFolders);
    if (gitRoot) {
      log("Extension", `Git repo detected, activating GitSpectra for: ${gitRoot}`);
      
      // Dispose this listener
      if (deferredActivationDisposable) {
        deferredActivationDisposable.dispose();
        deferredActivationDisposable = null;
      }
      
      // Re-activate with the found git root
      workspaceRoot = gitRoot;
      await activateForGitRepo(context, gitRoot);
    }
  });
  
  context.subscriptions.push(deferredActivationDisposable);
}

/**
 * Core activation logic once git repo is found
 */
async function activateForGitRepo(context: vscode.ExtensionContext, repoRoot: string): Promise<void> {
  workspaceRoot = repoRoot;
  gitDriver = new GitDriver(workspaceRoot);
  
  // Set context for "when" clauses
  await vscode.commands.executeCommand("setContext", "gitspectra.hasGit", true);

  log("Extension", "Git repository detected, initializing GitSpectra...");

  // Initialize config loader
  configLoader = new ConfigLoader(workspaceRoot);
  configLoader.initialize();

  const config = configLoader.getConfig();

  // Initialize conflict detector
  conflictDetector = new ConflictDetector(gitDriver, config);

  // Initialize UI providers
  decorationProvider = new ConflictDecorationProvider(config);
  fileDecorationProvider = new ConflictFileDecorationProvider();
  statusBarProvider = new StatusBarProvider(config);
  conflictPanelProvider = new ConflictPanelProvider(gitDriver, config, workspaceRoot);

  // Register file decoration provider for explorer
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(fileDecorationProvider)
  );

  // Register TreeView for conflict panel
  const treeView = vscode.window.createTreeView("gitspectra.panel", {
    treeDataProvider: conflictPanelProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Register content provider for diff views
  const diffProvider = new DiffContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider("gitspectra-diff", diffProvider)
  );

  // Register Activity Feed WebView
  activityFeedProvider = new ActivityFeedProvider(
    context.extensionUri,
    gitDriver,
    config,
    workspaceRoot
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ActivityFeedProvider.viewType,
      activityFeedProvider
    )
  );

  // Register for config changes
  configLoader.onConfigChange((newConfig) => {
    conflictDetector.setConfig(newConfig);
    decorationProvider.setConfig(newConfig);
    statusBarProvider.setConfig(newConfig);
    conflictPanelProvider.setConfig(newConfig);
    activityFeedProvider.setConfig(newConfig);
    setupFetchInterval(newConfig);
  });

  // Register disposables
  context.subscriptions.push(
    { dispose: () => configLoader.dispose() },
    { dispose: () => decorationProvider.dispose() },
    { dispose: () => fileDecorationProvider.dispose() },
    { dispose: () => statusBarProvider.dispose() },
    { dispose: () => clearFetchInterval() }
  );

  // Setup auto-fetch interval
  setupFetchInterval(config);

  // Show status bar immediately
  statusBarProvider.show();
  log("Extension", "Status bar shown");

  // Initial check
  isInitialized = true;
  
  // Delay initial check slightly to let UI settle
  setTimeout(async () => {
    await checkForConflicts();
  }, 1000);

  log("Extension", "GitSpectra activated successfully");
  log("Extension", `Git root: ${workspaceRoot}`);
  log("Extension", `Configured branches: ${config.scope?.branches?.join(", ") || "origin/main"}`);
  log("Extension", `Fetch interval: ${config.fetch?.interval || 300}s`);
}

export async function activate(context: vscode.ExtensionContext) {
  log("Extension", "GitSpectra is activating...");

  // Get workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    log("Extension", "No workspace folder open");
    return;
  }

  // Always register commands first (they'll show helpful messages if no git repo)
  registerCommands(context);

  // Try to find a git repository:
  // 1. Check the active file's directory first
  // 2. Fallback to workspace folders
  workspaceRoot = await findGitRoot(workspaceFolders);
  
  if (!workspaceRoot) {
    log("Extension", "No Git repository found in workspace or active file");
    // Don't return - set up listeners to activate when a git repo is opened
    setupDeferredActivation(context);
    return;
  }

  log("Extension", `Git root found: ${workspaceRoot}`);

  // Initialize Git driver
  gitDriver = new GitDriver(workspaceRoot);

  // Verify it's a git repo
  const isGitRepo = await gitDriver.isGitRepository();
  if (!isGitRepo) {
    log("Extension", "Not a Git repository, GitSpectra will not activate");
    setupDeferredActivation(context);
    return;
  }

  // Activate for the found git repo
  await activateForGitRepo(context, workspaceRoot);

  // Register for editor events
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && editor.document.uri.scheme === "file") {
        // Check if file is in a different git repo
        const fileGitRoot = getGitRootForFile(editor.document.uri.fsPath);
        if (fileGitRoot && fileGitRoot !== workspaceRoot) {
          log("Extension", `Switching to different repo: ${fileGitRoot}`);
          await switchToRepo(context, fileGitRoot);
        } else {
          updateEditorDecorations(editor);
        }
      }
    }),

    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const config = configLoader.getConfig();
      if (config.fetch?.onSave) {
        await checkForConflicts();
      }
    }),

    vscode.workspace.onDidOpenTextDocument(async (document) => {
      // Analyze newly opened files
      const editor = vscode.window.visibleTextEditors.find(
        (e) => e.document === document
      );
      if (editor) {
        await analyzeAndDecorate(editor);
      }
    })
  );
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("gitspectra.checkNow", async () => {
      if (!isInitialized) {
        vscode.window.showWarningMessage("GitSpectra: No git repository detected");
        return;
      }
      await checkForConflicts();
    }),

    vscode.commands.registerCommand("gitspectra.showPanel", async () => {
      log("Command", "Show Panel requested");
      // Focus the GitSpectra panel in the sidebar
      await vscode.commands.executeCommand("gitspectra.panel.focus");
      // Refresh the panel data
      if (conflictPanelProvider) {
        await conflictPanelProvider.refresh();
      }
    }),

    vscode.commands.registerCommand("gitspectra.configure", () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "gitspectra"
      );
    }),

    vscode.commands.registerCommand("gitspectra.dismissAll", () => {
      conflictCache.clear();
      if (fileDecorationProvider) {
        fileDecorationProvider.clearAll();
      }
      updateAllEditors();
      vscode.window.showInformationMessage(
        "GitSpectra: All conflicts dismissed"
      );
    }),

    vscode.commands.registerCommand(
      "gitspectra.dismissFile",
      (filePath?: string) => {
        const file =
          filePath || vscode.window.activeTextEditor?.document.uri.fsPath;
        if (file && gitDriver) {
          conflictCache.delete(gitDriver.getRelativePath(file));
          if (fileDecorationProvider) {
            fileDecorationProvider.updateFileReport(file, null);
          }
          updateActiveEditor();
        }
      }
    ),

    vscode.commands.registerCommand(
      "gitspectra.viewDiff",
      async (args: { file: string; branch: string }) => {
        await openDiffView(args.file, args.branch);
      }
    ),

    vscode.commands.registerCommand(
      "gitspectra.openFileDiff",
      async (args: { file: string; branch: string }) => {
        await openDiffView(args.file, args.branch);
      }
    ),

    vscode.commands.registerCommand(
      "gitspectra.openCommitDiff",
      async (beforeUri: vscode.Uri, afterUri: vscode.Uri, title: string) => {
        // Get content from activity feed provider
        const beforeContent = activityFeedProvider?.getDiffContent(beforeUri.toString()) || "";
        const afterContent = activityFeedProvider?.getDiffContent(afterUri.toString()) || "";

        // Store in diff cache
        diffContentCache.set(beforeUri.toString(), beforeContent);
        diffContentCache.set(afterUri.toString(), afterContent);

        // Open the diff editor
        await vscode.commands.executeCommand("vscode.diff", beforeUri, afterUri, title);
      }
    ),

    vscode.commands.registerCommand(
      "gitspectra.dismissConflict",
      (args: { file: string; line: number }) => {
        log("Command", `Dismiss conflict at line ${args.line} in ${args.file}`);
        vscode.window.showInformationMessage(
          `Dismissed conflict at line ${args.line}`
        );
      }
    ),

    vscode.commands.registerCommand(
      "gitspectra.cherryPick",
      async (args: { commit: string; branch: string }) => {
        log("Command", `Cherry pick from ${args.branch} (commit: ${args.commit})`);
        
        const result = await vscode.window.showInformationMessage(
          `Cherry pick changes from ${args.branch}?`,
          "Cherry Pick",
          "View Commit",
          "Cancel"
        );
        
        if (result === "Cherry Pick") {
          try {
            // Execute git cherry-pick
            const terminal = vscode.window.createTerminal("GitSpectra");
            terminal.show();
            terminal.sendText(`git cherry-pick ${args.commit}`);
          } catch (err) {
            error("Command", `Cherry pick failed: ${err}`);
            vscode.window.showErrorMessage(`Cherry pick failed: ${err}`);
          }
        } else if (result === "View Commit") {
          // Open the commit in the git log
          const terminal = vscode.window.createTerminal("GitSpectra");
          terminal.show();
          terminal.sendText(`git show ${args.commit}`);
        }
      }
    ),

    // Logging commands
    vscode.commands.registerCommand("gitspectra.copyLogs", async () => {
      await copyAllLogs();
    }),

    vscode.commands.registerCommand("gitspectra.showLogs", () => {
      showLogs();
    }),

    vscode.commands.registerCommand("gitspectra.refreshActivity", async () => {
      log("Command", "Refresh Activity Feed requested");
      if (activityFeedProvider) {
        await activityFeedProvider.refresh();
      }
    }),

    vscode.commands.registerCommand("gitspectra.showActivityFeed", async () => {
      log("Command", "Show Activity Feed requested");
      await vscode.commands.executeCommand("gitspectra.activityFeed.focus");
    })
  );
}

/**
 * Setup the auto-fetch interval based on config
 */
function setupFetchInterval(config: GitSpectraConfig): void {
  clearFetchInterval();

  const intervalSeconds = config.fetch?.interval || 0;
  if (intervalSeconds > 0) {
    fetchInterval = setInterval(
      async () => {
        await checkForConflicts();
      },
      intervalSeconds * 1000
    );
    log("Extension", `Auto-fetch enabled every ${intervalSeconds} seconds`);
  }
}

/**
 * Clear the fetch interval
 */
function clearFetchInterval(): void {
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
}

/**
 * Check for conflicts across all open files
 */
async function checkForConflicts(): Promise<void> {
  if (!isInitialized) return;

  log("Check", "Starting conflict check...");
  statusBarProvider.showFetching();

  try {
    // Check if there are any remotes configured
    const remoteBranches = await gitDriver.getRemoteBranches();
    log("Check", `Found ${remoteBranches.length} remote branches`);
    
    if (remoteBranches.length === 0) {
      log("Check", "No remote branches found - skipping fetch");
      statusBarProvider.hideFetching();
      vscode.window.showInformationMessage(
        "GitSpectra: No remote configured. Add a remote to detect conflicts."
      );
      return;
    }

    // Log some remote branches for debugging
    log("Check", `Remote branches: ${remoteBranches.slice(0, 5).join(", ")}${remoteBranches.length > 5 ? "..." : ""}`);

    // Fetch from remote
    const config = configLoader.getConfig();
    const remotes = config.fetch?.remotes || ["origin"];

    for (const remote of remotes) {
      try {
        log("Check", `Fetching from ${remote}...`);
        await gitDriver.fetch(remote);
        log("Check", `Fetched from ${remote} successfully`);
      } catch (err) {
        warn("Check", `Failed to fetch from ${remote}: ${err}`);
        // Continue even if fetch fails - we can still check local state
      }
    }

    // Get all open files
    const openFiles = vscode.window.visibleTextEditors
      .map((e) => e.document.uri.fsPath)
      .filter((f) => !f.includes("extension-output")); // Filter out extension output

    log("Check", `Analyzing ${openFiles.length} open files...`);
    for (const file of openFiles) {
      log("Check", `  - ${file.split("/").slice(-2).join("/")}`);
    }

    // Analyze files
    const result = await conflictDetector.analyzeFiles(openFiles);

    log("Check", `Analysis complete: ${result.totalConflicts} conflicts, ${result.totalWarnings} warnings`);

    // Update cache and file decorations
    const fileDecorationUpdates = new Map<string, FileConflictReport | null>();
    
    for (const [file, report] of result.reports) {
      conflictCache.set(file, report);
      
      // Get absolute path for file decorations
      const absolutePath = file.startsWith("/") ? file : `${workspaceRoot}/${file}`;
      fileDecorationUpdates.set(absolutePath, report);
      
      if (report.conflicts.length > 0 || report.warnings.length > 0) {
        log("Check", `  ${file}: ${report.conflicts.length} conflicts, ${report.warnings.length} warnings`);
      }
    }
    
    // Update file explorer decorations
    fileDecorationProvider.updateMultipleReports(fileDecorationUpdates);

    // Update status bar
    statusBarProvider.updateResult(result);

    // Update all editors
    updateAllEditors();

    // Show notification for new conflicts
    if (result.totalConflicts > 0) {
      log("Check", `⚠️ ${result.totalConflicts} conflict(s) detected!`);
      const config = configLoader.getConfig();
      if (config.notifications?.onConflictDetected) {
        vscode.window.showWarningMessage(
          `GitSpectra: ${result.totalConflicts} conflict(s) detected!`,
          "Show Details"
        ).then((action) => {
          if (action === "Show Details") {
            vscode.commands.executeCommand("gitspectra.showPanel");
          }
        });
      }
    } else {
      log("Check", "✅ No conflicts detected");
    }

    // Refresh the panel with latest data
    await conflictPanelProvider.refresh();
  } catch (err) {
    error("Check", `Error checking for conflicts: ${err}`);
  } finally {
    statusBarProvider.hideFetching();
  }
}

/**
 * Open a diff view comparing local file with remote branch version
 */
async function openDiffView(filePath: string, branch: string): Promise<void> {
  log("Diff", `Opening diff for ${filePath} against ${branch}`);
  
  try {
    // Use the current repo's workspace root (not the first workspace folder)
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No git repository detected");
      return;
    }

    // Get absolute and relative paths for the current repo
    const absolutePath = filePath.startsWith("/") ? filePath : `${workspaceRoot}/${filePath}`;
    const relativePath = absolutePath.startsWith(workspaceRoot)
      ? absolutePath.slice(workspaceRoot.length + 1)
      : filePath;

    // Check if local file exists
    const fs = await import("fs");
    const localFileExists = fs.existsSync(absolutePath);
    
    if (!localFileExists) {
      // File was likely renamed/moved - show helpful message
      const fileName = relativePath.split("/").pop() || relativePath;
      log("Diff", `Local file not found: ${absolutePath}`);
      
      // Try to show just the remote version
      try {
        const remoteContent = await gitDriver.showFile(branch, relativePath);
        if (remoteContent) {
          const remoteUri = vscode.Uri.parse(`gitspectra-diff:${branch}/${relativePath}`);
          diffContentCache.set(remoteUri.toString(), remoteContent);
          
          // Open just the remote file (no local to compare)
          await vscode.commands.executeCommand("vscode.open", remoteUri);
          vscode.window.showWarningMessage(
            `File "${fileName}" was renamed or moved. Showing version from ${branch.replace("origin/", "")}.`
          );
          return;
        }
      } catch {
        // File doesn't exist in remote either
      }
      
      vscode.window.showErrorMessage(
        `File "${fileName}" no longer exists at this path. It may have been renamed or deleted.`
      );
      return;
    }

    // Create local file URI
    const localUri = vscode.Uri.file(absolutePath);

    // Try to get file content from the branch using git show
    try {
      const remoteContent = await gitDriver.showFile(branch, relativePath);
      
      if (remoteContent) {
        // Create a virtual document with the remote content
        const remoteUri = vscode.Uri.parse(
          `gitspectra-diff:${branch}/${relativePath}`
        );
        
        // Store content for the content provider
        diffContentCache.set(remoteUri.toString(), remoteContent);

        // Open the diff editor
        const title = `${relativePath.split("/").pop()} (${branch.replace("origin/", "")} ↔ Local)`;
        
        await vscode.commands.executeCommand(
          "vscode.diff",
          remoteUri,
          localUri,
          title
        );
        
        log("Diff", `Opened diff view: ${title}`);
        return;
      }
    } catch (gitErr) {
      log("Diff", `Git show failed: ${gitErr}`);
    }

    // Fallback: file doesn't exist in remote branch, just open local
    log("Diff", `File not found in ${branch}, opening local file`);
    await vscode.commands.executeCommand("vscode.open", localUri);
    vscode.window.showInformationMessage(
      `File is new - not present in ${branch.replace("origin/", "")}`
    );
  } catch (err) {
    error("Diff", `Failed to open diff: ${err}`);
    vscode.window.showErrorMessage(`Could not open diff: ${err}`);
  }
}

// Cache for diff content
const diffContentCache = new Map<string, string>();

/**
 * Content provider for remote file content in diffs
 */
class DiffContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    const content = diffContentCache.get(uri.toString());
    return content || "";
  }
}

/**
 * Analyze a single editor and update decorations
 */
async function analyzeAndDecorate(editor: vscode.TextEditor): Promise<void> {
  const filePath = editor.document.uri.fsPath;
  const report = await conflictDetector.analyzeFile(filePath);

  if (report) {
    conflictCache.set(report.file, report);
    decorationProvider.updateDecorations(editor, report);
  }
}

/**
 * Update decorations for the active editor
 */
function updateActiveEditor(): void {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    updateEditorDecorations(editor);
  }
}

/**
 * Update decorations for all visible editors
 */
function updateAllEditors(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    updateEditorDecorations(editor);
  }
}

/**
 * Update decorations for a specific editor
 */
function updateEditorDecorations(editor: vscode.TextEditor): void {
  const relativePath = gitDriver.getRelativePath(editor.document.uri.fsPath);
  const report = conflictCache.get(relativePath) || null;
  decorationProvider.updateDecorations(editor, report);
}

export function deactivate() {
  log("Extension", "GitSpectra deactivating...");
  clearFetchInterval();
  logger.dispose();
}

