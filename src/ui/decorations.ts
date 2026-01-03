/**
 * Editor Decorations
 *
 * Handles gutter icons and line highlighting for conflict indicators.
 * Supports avatar-based gutter icons with avatars.
 */

import * as vscode from "vscode";
import * as crypto from "crypto";
import type { ConflictInfo, FileConflictReport } from "../analyzer/conflictDetector.js";
import type { GitSpectraConfig } from "../config/types.js";

export class ConflictDecorationProvider {
  private conflictDecorationType: vscode.TextEditorDecorationType;
  private warningDecorationType: vscode.TextEditorDecorationType;
  private config: GitSpectraConfig;
  
  // Cache for author-specific decoration types (for avatars)
  private authorDecorationCache: Map<string, vscode.TextEditorDecorationType> = new Map();

  constructor(config: GitSpectraConfig) {
    this.config = config;

    // Create decoration types
    this.conflictDecorationType = this.createConflictDecoration();
    this.warningDecorationType = this.createWarningDecoration();
  }

  /**
   * Get Gravatar URL for an email address
   */
  private getGravatarUrl(email: string, size: number = 16): string {
    const hash = crypto.createHash("md5").update(email.toLowerCase().trim()).digest("hex");
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
  }

  /**
   * Get or create a decoration type for a specific author (with avatar)
   */
  private getAuthorDecorationType(
    email: string,
    isConflict: boolean
  ): vscode.TextEditorDecorationType {
    const key = `${email}-${isConflict}`;
    
    if (this.authorDecorationCache.has(key)) {
      return this.authorDecorationCache.get(key)!;
    }

    const color = isConflict ? "#ef4444" : "#f59e0b";
    const bgColor = isConflict
      ? "gitspectra.conflictBackground"
      : "gitspectra.warningBackground";

    // Create SVG with avatar placeholder and colored border
    const avatarUrl = this.getGravatarUrl(email, 32);
    
    const decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: vscode.Uri.parse(avatarUrl),
      gutterIconSize: "contain",
      backgroundColor: new vscode.ThemeColor(bgColor),
      isWholeLine: true,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      // Add a colored left border to indicate conflict severity
      borderWidth: "0 0 0 3px",
      borderStyle: "solid",
      borderColor: color,
    });

    this.authorDecorationCache.set(key, decorationType);
    return decorationType;
  }

  /**
   * Create decoration type for hard conflicts (red)
   */
  private createConflictDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createGutterIcon("#ef4444"),
      gutterIconSize: "contain",
      backgroundColor: new vscode.ThemeColor("gitspectra.conflictBackground"),
      isWholeLine: true,
      overviewRulerColor: "#ef4444",
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  /**
   * Create decoration type for soft warnings (yellow)
   */
  private createWarningDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      gutterIconPath: this.createGutterIcon("#f59e0b"),
      gutterIconSize: "contain",
      backgroundColor: new vscode.ThemeColor("gitspectra.warningBackground"),
      isWholeLine: true,
      overviewRulerColor: "#f59e0b",
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  /**
   * Create a simple circle SVG for the gutter icon
   */
  private createGutterIcon(color: string): vscode.Uri {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill="${color}"/>
    </svg>`;

    return vscode.Uri.parse(
      `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
    );
  }

  /**
   * Update decorations for an editor based on conflict report
   */
  updateDecorations(
    editor: vscode.TextEditor,
    report: FileConflictReport | null
  ): void {
    if (!this.config.ui?.showInGutter) {
      this.clearDecorations(editor);
      return;
    }

    if (!report) {
      this.clearDecorations(editor);
      return;
    }

    // Group conflicts/warnings by author for avatar-based decorations
    const byAuthor = new Map<string, { isConflict: boolean; items: ConflictInfo[] }>();

    // Process hard conflicts
    for (const conflict of report.conflicts) {
      const key = conflict.source.email;
      if (!byAuthor.has(key)) {
        byAuthor.set(key, { isConflict: true, items: [] });
      }
      byAuthor.get(key)!.items.push(conflict);
    }

    // Process soft warnings
    for (const warning of report.warnings) {
      const key = warning.source.email;
      if (!byAuthor.has(key)) {
        byAuthor.set(key, { isConflict: false, items: [] });
      }
      byAuthor.get(key)!.items.push(warning);
    }

    // Clear old decorations first
    this.clearDecorations(editor);

    // Apply decorations per author (with avatars)
    for (const [email, data] of byAuthor) {
      const decorationType = this.getAuthorDecorationType(email, data.isConflict);
      const decorations: vscode.DecorationOptions[] = [];

      for (const item of data.items) {
        const options = this.createDecorationOptions(editor, item);
        decorations.push(...options);
      }

      editor.setDecorations(decorationType, decorations);
    }

    // Also apply fallback decorations for items without author
    const conflictDecorations: vscode.DecorationOptions[] = [];
    const warningDecorations: vscode.DecorationOptions[] = [];

    for (const conflict of report.conflicts.filter(c => !c.source.email)) {
      conflictDecorations.push(...this.createDecorationOptions(editor, conflict));
    }

    for (const warning of report.warnings.filter(w => !w.source.email)) {
      warningDecorations.push(...this.createDecorationOptions(editor, warning));
    }

    if (conflictDecorations.length > 0) {
      editor.setDecorations(this.conflictDecorationType, conflictDecorations);
    }
    if (warningDecorations.length > 0) {
      editor.setDecorations(this.warningDecorationType, warningDecorations);
    }
  }

  /**
   * Create decoration options for a conflict/warning
   */
  private createDecorationOptions(
    editor: vscode.TextEditor,
    conflict: ConflictInfo
  ): vscode.DecorationOptions[] {
    const decorations: vscode.DecorationOptions[] = [];
    const document = editor.document;

    // Ensure line numbers are within document bounds
    const startLine = Math.max(0, conflict.lines.start - 1);
    const endLine = Math.min(document.lineCount - 1, conflict.lines.end - 1);

    for (let line = startLine; line <= endLine; line++) {
      const lineRange = document.lineAt(line).range;

      decorations.push({
        range: lineRange,
        hoverMessage: this.createHoverMessage(conflict),
      });
    }

    return decorations;
  }

  /**
   * Create hover message for a conflict (rich details)
   */
  private createHoverMessage(conflict: ConflictInfo): vscode.MarkdownString {
    const isHardConflict = conflict.severity === "hard";
    const timeAgo = this.formatTimeAgo(conflict.source.date);
    const avatarUrl = this.getGravatarUrl(conflict.source.email, 48);
    const shortHash = conflict.source.commit.substring(0, 7);
    const branchName = conflict.source.branch.replace("origin/", "");

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;
    md.supportThemeIcons = true;  // Enable $(icon-name) codicon support

    // Severity indicator
    const severityIcon = isHardConflict ? "🔴" : "🟡";
    const severityLabel = isHardConflict ? "Conflict" : "Potential Conflict";

    // Header with avatar and severity
    md.appendMarkdown(
      `![avatar](${avatarUrl}|width=24) **${severityIcon} ${severityLabel} with ${conflict.source.author}**\n\n`
    );

    // Branch and time info
    md.appendMarkdown(`$(git-branch) \`${branchName}\` · ${timeAgo}\n\n`);

    // Commit message in a quote block
    md.appendMarkdown(`> ${conflict.source.message}\n\n`);

    // Commit details
    md.appendMarkdown(
      `$(git-commit) [\`${shortHash}\`](command:gitspectra.viewCommit?${encodeURIComponent(
        JSON.stringify({ commit: conflict.source.commit })
      )}) · `
    );
    
    // Lines affected
    const lineRange = conflict.lines.start === conflict.lines.end 
      ? `Line ${conflict.lines.start}`
      : `Lines ${conflict.lines.start}-${conflict.lines.end}`;
    md.appendMarkdown(`$(list-selection) ${lineRange}\n\n`);

    // Separator
    md.appendMarkdown(`---\n\n`);
    
    // Action buttons with better icons
    md.appendMarkdown(
      `$(git-pull-request) [Cherry pick these changes](command:gitspectra.cherryPick?${encodeURIComponent(
        JSON.stringify({ commit: conflict.source.commit, branch: conflict.source.branch })
      )}) `
    );

    md.appendMarkdown(
      `| $(git-compare) [View Diff](command:gitspectra.viewDiff?${encodeURIComponent(
        JSON.stringify({ file: conflict.file, branch: conflict.source.branch })
      )}) `
    );

    md.appendMarkdown(
      `| $(close) [Dismiss](command:gitspectra.dismissConflict?${encodeURIComponent(
        JSON.stringify({ file: conflict.file, line: conflict.lines.start })
      )})`
    );

    return md;
  }

  /**
   * Format a date as relative time
   */
  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    
    const minutes = Math.floor(seconds / 60);
    if (seconds < 3600) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
    
    const hours = Math.floor(seconds / 3600);
    if (seconds < 86400) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    
    const days = Math.floor(seconds / 86400);
    if (seconds < 604800) return days === 1 ? "1 day ago" : `${days} days ago`;
    
    const weeks = Math.floor(seconds / 604800);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  /**
   * Clear all decorations from an editor
   */
  clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.conflictDecorationType, []);
    editor.setDecorations(this.warningDecorationType, []);
    
    // Clear all author-specific decorations
    for (const decorationType of this.authorDecorationCache.values()) {
      editor.setDecorations(decorationType, []);
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: GitSpectraConfig): void {
    this.config = config;
  }

  /**
   * Dispose of decoration types
   */
  dispose(): void {
    this.conflictDecorationType.dispose();
    this.warningDecorationType.dispose();
    
    // Dispose all author-specific decorations
    for (const decorationType of this.authorDecorationCache.values()) {
      decorationType.dispose();
    }
    this.authorDecorationCache.clear();
  }
}

