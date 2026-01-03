/**
 * Configuration Loader
 *
 * Loads configuration from:
 * 1. VS Code workspace settings (highest priority)
 * 2. .gitspectra.json in repo root
 * 3. VS Code user settings
 * 4. Default values (lowest priority)
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  GitSpectraConfig,
  DEFAULT_CONFIG,
  mergeConfig,
} from "./types.js";

const CONFIG_FILENAME = ".gitspectra.json";

export class ConfigLoader {
  private workspaceRoot: string;
  private cachedConfig: GitSpectraConfig | null = null;
  private configWatcher: vscode.FileSystemWatcher | null = null;
  private onConfigChangeCallbacks: Array<(config: GitSpectraConfig) => void> = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Initialize config loader and watch for changes
   */
  initialize(): void {
    this.loadConfig();
    this.watchConfigFile();
    this.watchVSCodeSettings();
  }

  /**
   * Get the current configuration
   */
  getConfig(): GitSpectraConfig {
    if (!this.cachedConfig) {
      this.loadConfig();
    }
    return this.cachedConfig!;
  }

  /**
   * Register a callback for config changes
   */
  onConfigChange(callback: (config: GitSpectraConfig) => void): void {
    this.onConfigChangeCallbacks.push(callback);
  }

  /**
   * Load configuration from all sources
   */
  private loadConfig(): void {
    // Start with defaults
    let config: Partial<GitSpectraConfig> = {};

    // Load from .gitspectra.json if it exists
    const fileConfig = this.loadFromFile();
    if (fileConfig) {
      config = { ...config, ...fileConfig };
    }

    // Override with VS Code settings
    const vscodeConfig = this.loadFromVSCode();
    config = this.deepMerge(config, vscodeConfig);

    // Merge with defaults
    this.cachedConfig = mergeConfig(config);
  }

  /**
   * Load configuration from .gitspectra.json
   */
  private loadFromFile(): Partial<GitSpectraConfig> | null {
    const configPath = path.join(this.workspaceRoot, CONFIG_FILENAME);

    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(content);
        console.log(`Loaded config from ${CONFIG_FILENAME}`);
        return parsed;
      }
    } catch (error) {
      console.error(`Error loading ${CONFIG_FILENAME}:`, error);
    }

    return null;
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadFromVSCode(): Partial<GitSpectraConfig> {
    const vsConfig = vscode.workspace.getConfiguration("gitspectra");

    return {
      fetch: {
        interval: vsConfig.get<number>("fetchInterval"),
        onSave: vsConfig.get<boolean>("fetchOnSave"),
        onFocus: vsConfig.get<boolean>("fetchOnFocus"),
      },
      scope: {
        branches: vsConfig.get<string[]>("scope.branches"),
        excludeBranches: vsConfig.get<string[]>("scope.excludeBranches"),
        authors: vsConfig.get<string[]>("scope.authors"),
        timeWindow: vsConfig.get<string>("scope.timeWindow"),
      },
      ui: {
        showInGutter: vsConfig.get<boolean>("ui.showGutterIcons"),
        showInStatusBar: vsConfig.get<boolean>("ui.showStatusBar"),
      },
    };
  }

  /**
   * Watch for changes to .gitspectra.json
   */
  private watchConfigFile(): void {
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      CONFIG_FILENAME
    );

    this.configWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    const reload = () => {
      console.log(`${CONFIG_FILENAME} changed, reloading...`);
      this.loadConfig();
      this.notifyConfigChange();
    };

    this.configWatcher.onDidChange(reload);
    this.configWatcher.onDidCreate(reload);
    this.configWatcher.onDidDelete(reload);
  }

  /**
   * Watch for VS Code settings changes
   */
  private watchVSCodeSettings(): void {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("gitspectra")) {
        console.log("VS Code settings changed, reloading...");
        this.loadConfig();
        this.notifyConfigChange();
      }
    });
  }

  /**
   * Notify all listeners of config change
   */
  private notifyConfigChange(): void {
    const config = this.getConfig();
    for (const callback of this.onConfigChangeCallbacks) {
      callback(config);
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue === undefined) {
        continue;
      }

      if (
        typeof sourceValue === "object" &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === "object" &&
        targetValue !== null
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        result[key] = sourceValue;
      }
    }

    return result;
  }

  /**
   * Dispose of watchers
   */
  dispose(): void {
    this.configWatcher?.dispose();
  }
}

