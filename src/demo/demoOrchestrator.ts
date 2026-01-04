/**
 * Demo Orchestrator
 * 
 * Controls demo scenarios for marketing videos and presentations.
 * Injects fake data into GitSpectra's UI components to simulate
 * real-time team activity and conflict detection.
 * 
 * Usage:
 *   1. Run command "GitSpectra: Demo - Start Scenario"
 *   2. Select a scenario
 *   3. Record with Screen Studio
 *   4. Run "GitSpectra: Demo - Reset" to clean up
 */

import * as vscode from 'vscode';
import type { 
  DemoScenario, 
  DemoEvent, 
  DemoState, 
  DemoConflict, 
  DemoActivity,
  DemoCommit,
  DemoTeamMember 
} from './types.js';
import type { ActivityFeedProvider } from '../ui/activityFeed.js';
import type { ConflictPanelProvider } from '../ui/conflictPanel.js';
import type { ConflictDecorationProvider } from '../ui/decorations.js';
import type { StatusBarProvider } from '../ui/statusBar.js';
import type { FileConflictReport, ConflictInfo } from '../analyzer/conflictDetector.js';
import { log } from '../utils/logger.js';
import { 
  DEMO_TEAM, 
  getRandomTeamMember, 
  generateCommitHash, 
  relativeTime,
  DEMO_COMMIT_MESSAGES,
  DEMO_FILE_PATHS,
  DEMO_BRANCHES
} from './teamMembers.js';

export class DemoOrchestrator {
  private state: DemoState = {
    isRunning: false,
    currentScenario: null,
    startTime: 0,
    injectedConflicts: [],
    injectedActivities: [],
  };

  private timers: NodeJS.Timeout[] = [];
  private activityFeedProvider?: ActivityFeedProvider;
  private conflictPanelProvider?: ConflictPanelProvider;
  private decorationProvider?: ConflictDecorationProvider;
  private statusBarProvider?: StatusBarProvider;
  private workspacePath: string = '';

  // Callback to update conflict cache in extension.ts
  private onConflictInjected?: (file: string, report: FileConflictReport) => void;

  constructor() {
    log('Demo', 'DemoOrchestrator initialized');
  }

  /**
   * Set UI providers for injection
   */
  setProviders(options: {
    activityFeed?: ActivityFeedProvider;
    conflictPanel?: ConflictPanelProvider;
    decorations?: ConflictDecorationProvider;
    statusBar?: StatusBarProvider;
    workspacePath?: string;
    onConflictInjected?: (file: string, report: FileConflictReport) => void;
  }): void {
    this.activityFeedProvider = options.activityFeed;
    this.conflictPanelProvider = options.conflictPanel;
    this.decorationProvider = options.decorations;
    this.statusBarProvider = options.statusBar;
    this.workspacePath = options.workspacePath || '';
    this.onConflictInjected = options.onConflictInjected;
  }

  /**
   * Check if demo mode is currently running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Start a demo scenario
   */
  async startScenario(scenario: DemoScenario): Promise<void> {
    if (this.state.isRunning) {
      await this.stop();
    }

    log('Demo', `Starting scenario: ${scenario.name}`);
    vscode.window.showInformationMessage(`🎬 Demo: Starting "${scenario.name}"`);

    this.state = {
      isRunning: true,
      currentScenario: scenario,
      startTime: Date.now(),
      injectedConflicts: [],
      injectedActivities: [],
    };

    // Schedule all events
    for (const event of scenario.events) {
      const timer = setTimeout(() => {
        this.executeEvent(event);
      }, event.at);
      this.timers.push(timer);
    }

    // Handle scenario end
    const endTimer = setTimeout(() => {
      if (scenario.loop) {
        log('Demo', 'Scenario looping...');
        this.reset();
        this.startScenario(scenario);
      } else {
        log('Demo', 'Scenario completed');
        vscode.window.showInformationMessage(`🎬 Demo: "${scenario.name}" completed`);
        this.state.isRunning = false;
      }
    }, scenario.duration);
    this.timers.push(endTimer);
  }

  /**
   * Stop the current demo
   */
  async stop(): Promise<void> {
    log('Demo', 'Stopping demo');
    
    // Clear all timers
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
    
    this.state.isRunning = false;
    this.state.currentScenario = null;
  }

  /**
   * Reset demo state and clear all injected data
   */
  async reset(): Promise<void> {
    await this.stop();
    
    log('Demo', 'Resetting demo state');
    
    this.state.injectedConflicts = [];
    this.state.injectedActivities = [];
    
    // Clear UI
    if (this.activityFeedProvider) {
      // @ts-ignore - we'll add this method
      this.activityFeedProvider.clearDemoData?.();
      this.activityFeedProvider.refresh();
    }
    
    if (this.conflictPanelProvider) {
      // @ts-ignore
      this.conflictPanelProvider.clearDemoData?.();
      this.conflictPanelProvider.refresh();
    }
    
    if (this.decorationProvider) {
      // @ts-ignore
      this.decorationProvider.clearDemoData?.();
    }
    
    if (this.statusBarProvider) {
      this.statusBarProvider.updateResult({
        reports: new Map(),
        totalConflicts: 0,
        totalWarnings: 0,
        analyzedAt: new Date(),
      });
    }
    
    vscode.window.showInformationMessage('🎬 Demo: Reset complete');
  }

  /**
   * Execute a single demo event
   */
  private async executeEvent(event: DemoEvent): Promise<void> {
    log('Demo', `Executing event: ${event.action}${event.description ? ` - ${event.description}` : ''}`);

    switch (event.action) {
      case 'showActivityFeed':
        await vscode.commands.executeCommand('gitspectra.activityFeed.focus');
        break;

      case 'showConflictPanel':
        await vscode.commands.executeCommand('gitspectra.panel.focus');
        break;

      case 'focusEditor':
        if (event.data?.file) {
          const filePath = event.data.file.startsWith('/') 
            ? event.data.file 
            : `${this.workspacePath}/${event.data.file}`;
          try {
            const uri = vscode.Uri.file(filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc);
            
            if (event.data.line) {
              const position = new vscode.Position(event.data.line - 1, 0);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
          } catch (err) {
            log('Demo', `Could not open file: ${filePath}`);
          }
        }
        break;

      case 'injectCommit':
      case 'injectActivity':
        await this.injectActivity(event.data);
        break;

      case 'injectConflict':
        await this.injectConflict(event.data);
        break;

      case 'showHover':
        // Trigger hover by moving cursor
        if (event.data?.line) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const position = new vscode.Position(event.data.line - 1, 10);
            editor.selection = new vscode.Selection(position, position);
            // Trigger hover
            await vscode.commands.executeCommand('editor.action.showHover');
          }
        }
        break;

      case 'clearAll':
        await this.reset();
        break;

      case 'triggerRefresh':
        if (this.activityFeedProvider) {
          await this.activityFeedProvider.refresh();
        }
        if (this.conflictPanelProvider) {
          await this.conflictPanelProvider.refresh();
        }
        break;

      case 'showNotification':
        if (event.data?.message) {
          vscode.window.showWarningMessage(event.data.message);
        }
        break;

      case 'scrollActivityFeed':
        // Send message to webview to scroll
        if (this.activityFeedProvider) {
          // @ts-ignore
          this.activityFeedProvider.postMessage?.({ type: 'scrollTo', position: event.data?.position || 'top' });
        }
        break;

      case 'filterByPerson':
        if (this.activityFeedProvider && event.data?.email) {
          // @ts-ignore
          this.activityFeedProvider.postMessage?.({ type: 'filterAuthor', author: event.data.email });
        }
        break;

      case 'switchView':
        if (this.activityFeedProvider && event.data?.view) {
          // @ts-ignore
          this.activityFeedProvider.postMessage?.({ type: 'viewMode', mode: event.data.view });
        }
        break;
    }
  }

  /**
   * Inject a fake activity into the Activity Feed
   */
  async injectActivity(data: Partial<DemoActivity> & { author?: DemoTeamMember | string }): Promise<void> {
    // Resolve author
    let author: DemoTeamMember;
    if (typeof data.author === 'string') {
      author = DEMO_TEAM.find(m => m.name === data.author) || getRandomTeamMember();
    } else {
      author = data.author || getRandomTeamMember();
    }

    const activity: DemoActivity = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: data.type || 'commit',
      author,
      date: data.date || new Date(),
      branch: data.branch || DEMO_BRANCHES[Math.floor(Math.random() * DEMO_BRANCHES.length)],
      message: data.message || DEMO_COMMIT_MESSAGES[Math.floor(Math.random() * DEMO_COMMIT_MESSAGES.length)],
      files: data.files || [{
        path: DEMO_FILE_PATHS[Math.floor(Math.random() * DEMO_FILE_PATHS.length)],
        status: 'modified',
      }],
      isMerge: data.isMerge,
    };

    this.state.injectedActivities.push(activity);
    log('Demo', `Injected activity from ${author.name}: ${activity.message.slice(0, 40)}...`);

    // Inject into activity feed provider
    if (this.activityFeedProvider) {
      // @ts-ignore - we'll add this method
      this.activityFeedProvider.injectDemoActivity?.(activity);
    }
  }

  /**
   * Inject a fake conflict
   */
  async injectConflict(data: Partial<DemoConflict> & { author?: DemoTeamMember | string }): Promise<void> {
    // Resolve author
    let author: DemoTeamMember;
    if (typeof data.author === 'string') {
      author = DEMO_TEAM.find(m => m.name === data.author) || getRandomTeamMember();
    } else {
      author = data.author || getRandomTeamMember();
    }

    const conflict: DemoConflict = {
      file: data.file || DEMO_FILE_PATHS[0],
      lines: data.lines || { start: 45, end: 52 },
      severity: data.severity || 'hard',
      author,
      branch: data.branch || 'origin/main',
      commit: data.commit || generateCommitHash(),
      message: data.message || DEMO_COMMIT_MESSAGES[Math.floor(Math.random() * DEMO_COMMIT_MESSAGES.length)],
    };

    this.state.injectedConflicts.push(conflict);
    log('Demo', `Injected conflict in ${conflict.file} lines ${conflict.lines.start}-${conflict.lines.end}`);

    // Create a FileConflictReport
    const conflictInfo: ConflictInfo = {
      file: conflict.file,
      lines: conflict.lines,
      severity: conflict.severity,
      source: {
        branch: conflict.branch,
        commit: conflict.commit,
        author: conflict.author.name,
        email: conflict.author.email,
        date: new Date(),
        message: conflict.message,
      },
    };

    const report: FileConflictReport = {
      file: conflict.file,
      conflicts: conflict.severity === 'hard' ? [conflictInfo] : [],
      warnings: conflict.severity === 'soft' ? [conflictInfo] : [],
      lastAnalyzed: new Date(),
      targetBranch: conflict.branch,
    };

    // Update UI providers
    if (this.onConflictInjected) {
      this.onConflictInjected(conflict.file, report);
    }

    if (this.conflictPanelProvider) {
      // @ts-ignore
      this.conflictPanelProvider.injectDemoConflict?.(conflict.file, report);
      await this.conflictPanelProvider.refresh();
    }

    if (this.statusBarProvider) {
      const totalConflicts = this.state.injectedConflicts.filter(c => c.severity === 'hard').length;
      const totalWarnings = this.state.injectedConflicts.filter(c => c.severity === 'soft').length;
      this.statusBarProvider.updateResult({
        reports: new Map(),
        totalConflicts,
        totalWarnings,
        analyzedAt: new Date(),
      });
    }

    // Show notification for new conflict
    if (conflict.severity === 'hard') {
      vscode.window.showWarningMessage(
        `⚠️ Conflict detected: ${conflict.author.name} changed ${conflict.file.split('/').pop()} (lines ${conflict.lines.start}-${conflict.lines.end})`
      );
    }

    // Trigger decoration update on active editor
    const editor = vscode.window.activeTextEditor;
    if (editor && this.decorationProvider) {
      this.decorationProvider.updateDecorations(editor, report);
    }
  }

  /**
   * Quick inject: Add a single activity with minimal config
   */
  async quickInjectActivity(authorName: string, message: string, file?: string): Promise<void> {
    await this.injectActivity({
      author: authorName,
      message,
      files: file ? [{ path: file, status: 'modified' }] : undefined,
    });
  }

  /**
   * Quick inject: Add a conflict with minimal config
   */
  async quickInjectConflict(
    file: string, 
    startLine: number, 
    endLine: number, 
    authorName: string,
    severity: 'hard' | 'soft' = 'hard'
  ): Promise<void> {
    await this.injectConflict({
      file,
      lines: { start: startLine, end: endLine },
      author: authorName,
      severity,
    });
  }

  /**
   * Get current demo state (for debugging)
   */
  getState(): DemoState {
    return { ...this.state };
  }
}

// Singleton instance
let demoOrchestratorInstance: DemoOrchestrator | null = null;

export function getDemoOrchestrator(): DemoOrchestrator {
  if (!demoOrchestratorInstance) {
    demoOrchestratorInstance = new DemoOrchestrator();
  }
  return demoOrchestratorInstance;
}

