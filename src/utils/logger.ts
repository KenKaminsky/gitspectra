/**
 * GitSpectra Logger
 *
 * Centralized logging with ability to copy all logs.
 * Set GITSPECTRA_DEBUG=true env var for verbose output.
 */

import * as vscode from "vscode";

const LOG_PREFIX = "[GitSpectra]";
const MAX_LOG_ENTRIES = 1000;

// Check for debug mode via env var or VS Code setting
const isDebugMode = (): boolean => {
  return (
    process.env.GITSPECTRA_DEBUG === "true" ||
    vscode.workspace.getConfiguration("gitspectra").get<boolean>("debugMode", false)
  );
};

interface LogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  component: string;
  message: string;
}

class GitSpectraLogger {
  private logs: LogEntry[] = [];
  private outputChannel: vscode.OutputChannel;
  private hasShownChannel = false;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("GitSpectra");
    
    // Auto-show output in debug mode
    if (isDebugMode()) {
      this.outputChannel.show(true); // true = preserve focus
      this.outputChannel.appendLine("🔧 DEBUG MODE ENABLED");
      this.outputChannel.appendLine(`   Workspace: ${vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath).join(", ") || "none"}`);
      this.outputChannel.appendLine(`   Time: ${new Date().toISOString()}`);
      this.outputChannel.appendLine("─".repeat(60));
    }
  }

  private addEntry(
    level: LogEntry["level"],
    component: string,
    message: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
    };

    this.logs.push(entry);

    // Keep logs bounded
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }

    // Format for output channel
    const formatted = this.formatEntry(entry);
    this.outputChannel.appendLine(formatted);

    // Also log to console for Developer Tools
    const consoleMessage = `${LOG_PREFIX} [${component}] ${message}`;
    switch (level) {
      case "error":
        console.error(consoleMessage);
        break;
      case "warn":
        console.warn(consoleMessage);
        break;
      case "debug":
        console.debug(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }
  }

  private formatEntry(entry: LogEntry): string {
    const time = entry.timestamp.toISOString().split("T")[1].slice(0, 12);
    const level = entry.level.toUpperCase().padEnd(5);
    return `${time} ${level} [${entry.component}] ${entry.message}`;
  }

  log(component: string, message: string): void {
    this.addEntry("info", component, message);
  }

  warn(component: string, message: string): void {
    this.addEntry("warn", component, message);
  }

  error(component: string, message: string): void {
    this.addEntry("error", component, message);
  }

  debug(component: string, message: string): void {
    this.addEntry("debug", component, message);
  }

  /**
   * Get all logs as a formatted string
   */
  getAllLogs(): string {
    const header = [
      "=".repeat(60),
      "GitSpectra Logs",
      `Exported: ${new Date().toISOString()}`,
      `Total entries: ${this.logs.length}`,
      "=".repeat(60),
      "",
    ].join("\n");

    const logText = this.logs.map((e) => this.formatEntry(e)).join("\n");

    return header + logText;
  }

  /**
   * Copy all logs to clipboard
   */
  async copyAllLogs(): Promise<void> {
    const logs = this.getAllLogs();
    await vscode.env.clipboard.writeText(logs);
    vscode.window.showInformationMessage(
      `GitSpectra: ${this.logs.length} log entries copied to clipboard`
    );
  }

  /**
   * Show the output channel
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    this.outputChannel.clear();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Singleton instance
export const logger = new GitSpectraLogger();

// Helper functions for convenience
export const log = (component: string, message: string) =>
  logger.log(component, message);
export const warn = (component: string, message: string) =>
  logger.warn(component, message);
export const error = (component: string, message: string) =>
  logger.error(component, message);
export const debug = (component: string, message: string) =>
  logger.debug(component, message);

export async function copyAllLogs(): Promise<void> {
  await logger.copyAllLogs();
}

export function showLogs(): void {
  logger.show();
}

