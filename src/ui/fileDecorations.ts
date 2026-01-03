/**
 * File Explorer Decorations
 *
 * Shows conflict indicators on files in the VS Code file explorer.
 * Red badge for conflicts, yellow badge for warnings.
 */

import * as vscode from "vscode";
import * as crypto from "crypto";
import type { FileConflictReport } from "../analyzer/conflictDetector.js";

export class ConflictFileDecorationProvider
  implements vscode.FileDecorationProvider
{
  private _onDidChangeFileDecorations =
    new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  // Map of file paths to their conflict reports
  private conflictReports: Map<string, FileConflictReport> = new Map();

  /**
   * Update the conflict report for a file
   */
  updateFileReport(filePath: string, report: FileConflictReport | null): void {
    if (report && (report.conflicts.length > 0 || report.warnings.length > 0)) {
      this.conflictReports.set(filePath, report);
    } else {
      this.conflictReports.delete(filePath);
    }

    // Notify VS Code that decorations changed
    const uri = vscode.Uri.file(filePath);
    this._onDidChangeFileDecorations.fire(uri);
  }

  /**
   * Bulk update for multiple files
   */
  updateMultipleReports(
    reports: Map<string, FileConflictReport | null>
  ): void {
    const changedUris: vscode.Uri[] = [];

    for (const [filePath, report] of reports) {
      if (report && (report.conflicts.length > 0 || report.warnings.length > 0)) {
        this.conflictReports.set(filePath, report);
      } else {
        this.conflictReports.delete(filePath);
      }
      changedUris.push(vscode.Uri.file(filePath));
    }

    // Batch notify
    if (changedUris.length > 0) {
      this._onDidChangeFileDecorations.fire(changedUris);
    }
  }

  /**
   * Clear all conflict reports
   */
  clearAll(): void {
    const uris = Array.from(this.conflictReports.keys()).map((p) =>
      vscode.Uri.file(p)
    );
    this.conflictReports.clear();
    if (uris.length > 0) {
      this._onDidChangeFileDecorations.fire(uris);
    }
  }

  /**
   * Provide file decoration for a URI
   */
  provideFileDecoration(
    uri: vscode.Uri
  ): vscode.FileDecoration | undefined {
    const report = this.conflictReports.get(uri.fsPath);

    if (!report) {
      return undefined;
    }

    const hasConflicts = report.conflicts.length > 0;
    const hasWarnings = report.warnings.length > 0;

    if (!hasConflicts && !hasWarnings) {
      return undefined;
    }

    // Determine severity and create decoration
    if (hasConflicts) {
      // Hard conflict - red badge
      const conflictCount = report.conflicts.length;
      const firstConflict = report.conflicts[0];
      const author = firstConflict.source.author;
      const branch = firstConflict.source.branch.replace("origin/", "");

      return {
        badge: "⚠",
        color: new vscode.ThemeColor("gitspectra.conflictBadge"),
        tooltip: this.createTooltip(report, true),
        propagate: false,
      };
    } else {
      // Soft warning - yellow badge
      const warningCount = report.warnings.length;
      const firstWarning = report.warnings[0];
      const author = firstWarning.source.author;

      return {
        badge: "△",
        color: new vscode.ThemeColor("gitspectra.warningBadge"),
        tooltip: this.createTooltip(report, false),
        propagate: false,
      };
    }
  }

  /**
   * Create tooltip text for file decoration
   */
  private createTooltip(report: FileConflictReport, isConflict: boolean): string {
    const items = isConflict ? report.conflicts : report.warnings;
    
    // Group by author
    const byAuthor = new Map<string, { branch: string; count: number; message: string }>();
    
    for (const item of items) {
      const key = item.source.author;
      if (!byAuthor.has(key)) {
        byAuthor.set(key, {
          branch: item.source.branch.replace("origin/", ""),
          count: 1,
          message: item.source.message,
        });
      } else {
        byAuthor.get(key)!.count++;
      }
    }

    const lines: string[] = [];
    
    if (isConflict) {
      lines.push(`🔴 ${items.length} Conflict${items.length > 1 ? "s" : ""} Detected`);
    } else {
      lines.push(`🟡 ${items.length} Potential Conflict${items.length > 1 ? "s" : ""}`);
    }
    
    lines.push("");
    
    for (const [author, info] of byAuthor) {
      lines.push(`• ${author} on ${info.branch}`);
      lines.push(`  "${info.message}"`);
      if (info.count > 1) {
        lines.push(`  (${info.count} locations)`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Dispose
   */
  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}

