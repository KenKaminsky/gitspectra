/**
 * Demo Mode Types
 * 
 * Type definitions for the demo orchestration system.
 * Used for creating repeatable marketing videos and demos.
 */

export interface DemoTeamMember {
  name: string;
  email: string;
  avatar?: string;  // URL or base64
  githubUsername?: string;
}

export interface DemoCommit {
  hash: string;
  author: DemoTeamMember;
  date: Date;
  message: string;
  branch: string;
  files: DemoFileChange[];
}

export interface DemoFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  linesChanged?: { start: number; end: number }[];
}

export interface DemoConflict {
  file: string;
  lines: { start: number; end: number };
  severity: 'hard' | 'soft';
  author: DemoTeamMember;
  branch: string;
  commit: string;
  message: string;
}

export interface DemoActivity {
  id: string;
  type: 'commit' | 'branch' | 'merge';
  author: DemoTeamMember;
  date: Date;
  branch: string;
  message: string;
  files: DemoFileChange[];
  isMerge?: boolean;
}

export type DemoEventType = 
  | 'showActivityFeed'
  | 'showConflictPanel'
  | 'focusEditor'
  | 'injectCommit'
  | 'injectActivity'
  | 'injectConflict'
  | 'showHover'
  | 'clearAll'
  | 'triggerRefresh'
  | 'showNotification'
  | 'scrollActivityFeed'
  | 'filterByPerson'
  | 'switchView';

export interface DemoEvent {
  at: number;  // milliseconds from start
  action: DemoEventType;
  data?: any;
  description?: string;  // For debugging/logging
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  duration: number;  // Total duration in milliseconds
  events: DemoEvent[];
  loop?: boolean;  // Should this scenario loop?
}

export interface DemoState {
  isRunning: boolean;
  currentScenario: DemoScenario | null;
  startTime: number;
  injectedConflicts: DemoConflict[];
  injectedActivities: DemoActivity[];
}

