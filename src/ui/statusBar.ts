/**
 * Status Bar Provider
 *
 * Shows conflict summary in the VS Code status bar.
 */

import * as vscode from "vscode";
import type { AnalysisResult } from "../analyzer/conflictDetector.js";
import type { GitSpectraConfig } from "../config/types.js";

export class StatusBarProvider {
  private statusBarItem: vscode.StatusBarItem;
  private config: GitSpectraConfig;
  private lastResult: AnalysisResult | null = null;
  private isFetching: boolean = false;

  constructor(config: GitSpectraConfig) {
    this.config = config;

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.statusBarItem.command = "gitspectra.showPanel";
    this.statusBarItem.tooltip = "Click to open GitSpectra panel";

    this.updateDisplay();
  }

  /**
   * Update the display based on current state
   */
  private updateDisplay(): void {
    if (!this.config.ui?.showInStatusBar) {
      this.statusBarItem.hide();
      return;
    }

    if (this.isFetching) {
      this.statusBarItem.text = "$(sync~spin) GitSpectra";
      this.statusBarItem.tooltip = "Fetching remote changes...";
      this.statusBarItem.backgroundColor = undefined;
    } else if (this.lastResult) {
      const { totalConflicts, totalWarnings } = this.lastResult;

      if (totalConflicts > 0) {
        this.statusBarItem.text = `$(alert) ${totalConflicts} conflict${totalConflicts > 1 ? "s" : ""}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground"
        );
        this.statusBarItem.tooltip = this.buildTooltip();
      } else if (totalWarnings > 0) {
        this.statusBarItem.text = `$(warning) ${totalWarnings} warning${totalWarnings > 1 ? "s" : ""}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground"
        );
        this.statusBarItem.tooltip = this.buildTooltip();
      } else {
        this.statusBarItem.text = "$(shield) GitSpectra";
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = "No conflicts detected";
      }
    } else {
      this.statusBarItem.text = "$(shield) GitSpectra";
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = "No conflicts detected. Click to check now.";
    }

    // Always show the status bar item
    this.statusBarItem.show();
    console.log(`Status bar updated: ${this.statusBarItem.text}`);
  }

  /**
   * Build detailed tooltip
   */
  private buildTooltip(): string {
    if (!this.lastResult) return "GitSpectra";

    const lines: string[] = ["GitSpectra Status", ""];

    if (this.lastResult.totalConflicts > 0) {
      lines.push(`⚠️ ${this.lastResult.totalConflicts} conflict(s)`);
    }

    if (this.lastResult.totalWarnings > 0) {
      lines.push(`⚡ ${this.lastResult.totalWarnings} warning(s)`);
    }

    lines.push("");
    lines.push(`Last checked: ${this.formatTime(this.lastResult.analyzedAt)}`);
    lines.push("");
    lines.push("Click to open panel");

    return lines.join("\n");
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Update with new analysis result
   */
  updateResult(result: AnalysisResult): void {
    this.lastResult = result;
    this.updateDisplay();
  }

  /**
   * Show fetching state
   */
  showFetching(): void {
    this.isFetching = true;
    this.updateDisplay();
  }

  /**
   * Hide fetching state
   */
  hideFetching(): void {
    this.isFetching = false;
    this.updateDisplay();
  }

  /**
   * Update configuration
   */
  setConfig(config: GitSpectraConfig): void {
    this.config = config;
    this.updateDisplay();
  }

  /**
   * Show the status bar item
   */
  show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar item
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Dispose of status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}

