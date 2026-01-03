/**
 * GitSpectra Configuration Types
 *
 * Defines the schema for .gitspectra.json and VS Code settings.
 */

export interface GitSpectraConfig {
  version?: string;

  fetch?: FetchConfig;
  scope?: ScopeConfig;
  team?: TeamConfig;
  ui?: UIConfig;
  notifications?: NotificationConfig;
  files?: FilesConfig;
}

export interface FetchConfig {
  /** Interval in seconds between automatic fetches (0 = disabled) */
  interval?: number;

  /** Fetch when saving a file */
  onSave?: boolean;

  /** Fetch when focusing a file */
  onFocus?: boolean;

  /** Remotes to fetch from */
  remotes?: string[];
}

export interface ScopeConfig {
  /** Only track commits from these authors */
  authors?: string[];

  /** Time window for commit tracking (e.g., "7d", "2w", "1m") */
  timeWindow?: string;

  /** Branches to check for conflicts */
  branches?: string[];

  /** Branch patterns to exclude */
  excludeBranches?: string[];
}

export interface TeamConfig {
  /** Team member definitions */
  members?: TeamMember[];
}

export interface TeamMember {
  name: string;
  email: string;
  github?: string;
}

export interface UIConfig {
  /** Show conflict indicators in the editor gutter */
  showInGutter?: boolean;

  /** Show conflict count in the status bar */
  showInStatusBar?: boolean;

  /** Color for hard conflicts */
  conflictColor?: string;

  /** Color for soft warnings */
  warningColor?: string;
}

export interface NotificationConfig {
  /** Show notification when conflict is detected */
  onConflictDetected?: boolean;

  /** Show notification when team member commits */
  onNewCommitFromTeam?: boolean;

  /** Debounce time in milliseconds for notifications */
  debounceMs?: number;
}

export interface FilesConfig {
  /** File patterns to include */
  include?: string[];

  /** File patterns to exclude */
  exclude?: string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: GitSpectraConfig = {
  version: "1.0",
  fetch: {
    interval: 300,
    onSave: true,
    onFocus: false,
    remotes: ["origin"],
  },
  scope: {
    authors: [],
    timeWindow: "30d",
    branches: ["origin/main"],
    excludeBranches: ["origin/dependabot/*", "origin/renovate/*"],
  },
  team: {
    members: [],
  },
  ui: {
    showInGutter: true,
    showInStatusBar: true,
    conflictColor: "#ef4444",
    warningColor: "#f59e0b",
  },
  notifications: {
    onConflictDetected: true,
    onNewCommitFromTeam: false,
    debounceMs: 5000,
  },
  files: {
    include: [],
    exclude: ["**/node_modules/**", "**/.git/**"],
  },
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(
  userConfig: Partial<GitSpectraConfig>
): GitSpectraConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    fetch: { ...DEFAULT_CONFIG.fetch, ...userConfig.fetch },
    scope: { ...DEFAULT_CONFIG.scope, ...userConfig.scope },
    team: { ...DEFAULT_CONFIG.team, ...userConfig.team },
    ui: { ...DEFAULT_CONFIG.ui, ...userConfig.ui },
    notifications: {
      ...DEFAULT_CONFIG.notifications,
      ...userConfig.notifications,
    },
    files: { ...DEFAULT_CONFIG.files, ...userConfig.files },
  };
}

