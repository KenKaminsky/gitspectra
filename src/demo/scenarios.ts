/**
 * Demo Scenarios
 * 
 * Pre-built demo scenarios for marketing videos.
 * Each scenario is designed to showcase specific features
 * in a visually engaging way.
 */

import type { DemoScenario, DemoEvent } from './types.js';
import { DEMO_TEAM, relativeTime, DEMO_FILE_PATHS } from './teamMembers.js';

/**
 * Scenario 1: Conflict Detection
 * Duration: ~20 seconds
 * 
 * Shows a conflict appearing in real-time while coding.
 * Perfect for the "aha moment" of GitSpectra.
 */
export const SCENARIO_CONFLICT_DETECTION: DemoScenario = {
  id: 'conflict-detection',
  name: 'Conflict Detection Demo',
  description: 'Shows a conflict appearing in real-time as a teammate pushes changes',
  duration: 20000,
  events: [
    {
      at: 0,
      action: 'focusEditor',
      data: { file: 'src/components/Dashboard.tsx', line: 40 },
      description: 'Open the file where conflict will appear',
    },
    {
      at: 2000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[0], // Sarah Chen
        message: 'Refactored Dashboard component layout',
        files: [{ path: 'src/components/Dashboard.tsx', status: 'modified' }],
        branch: 'origin/main',
      },
      description: 'Sarah pushes a commit',
    },
    {
      at: 4000,
      action: 'injectConflict',
      data: {
        file: 'src/components/Dashboard.tsx',
        lines: { start: 45, end: 52 },
        severity: 'hard',
        author: DEMO_TEAM[0],
        message: 'Refactored Dashboard component layout',
        branch: 'origin/main',
      },
      description: 'Conflict appears on lines 45-52',
    },
    {
      at: 7000,
      action: 'showHover',
      data: { line: 47 },
      description: 'Show hover with conflict details',
    },
    {
      at: 12000,
      action: 'showConflictPanel',
      description: 'Show the Conflict Radar panel',
    },
    {
      at: 16000,
      action: 'focusEditor',
      data: { file: 'src/components/Dashboard.tsx', line: 47 },
      description: 'Return focus to the conflicting line',
    },
  ],
};

/**
 * Scenario 2: Activity Feed
 * Duration: ~25 seconds
 * 
 * Shows the Activity Feed with team members actively committing.
 * Demonstrates the real-time collaboration awareness.
 */
export const SCENARIO_ACTIVITY_FEED: DemoScenario = {
  id: 'activity-feed',
  name: 'Activity Feed Demo',
  description: 'Shows team activity flowing into the Activity Feed in real-time',
  duration: 25000,
  events: [
    {
      at: 0,
      action: 'showActivityFeed',
      description: 'Focus the Activity Feed panel',
    },
    {
      at: 1500,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[1], // Marcus Johnson
        message: 'Fix race condition in WebSocket handler',
        files: [
          { path: 'src/hooks/useWebSocket.ts', status: 'modified' },
          { path: 'src/services/api.ts', status: 'modified' },
        ],
        branch: 'origin/main',
      },
    },
    {
      at: 4000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[2], // Elena Rodriguez
        message: 'Add loading states to dashboard components',
        files: [
          { path: 'src/components/Dashboard.tsx', status: 'modified' },
          { path: 'src/components/Sidebar.tsx', status: 'modified' },
        ],
        branch: 'origin/feature/dashboard-v2',
      },
    },
    {
      at: 7000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[3], // Alex Kim
        message: 'Update API response types for v2 endpoints',
        files: [
          { path: 'src/types/user.ts', status: 'modified' },
          { path: 'src/services/api.ts', status: 'modified' },
        ],
        branch: 'origin/main',
      },
    },
    {
      at: 10000,
      action: 'injectConflict',
      data: {
        file: 'src/services/api.ts',
        lines: { start: 120, end: 135 },
        severity: 'soft',
        author: DEMO_TEAM[3],
        message: 'Update API response types for v2 endpoints',
        branch: 'origin/main',
      },
      description: 'Warning: you also touched api.ts',
    },
    {
      at: 13000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[4], // Jordan Taylor
        message: 'Optimize database queries for user lookup',
        files: [{ path: 'src/services/auth.ts', status: 'modified' }],
        branch: 'origin/main',
      },
    },
    {
      at: 16000,
      action: 'switchView',
      data: { view: 'person' },
      description: 'Switch to By Person view',
    },
    {
      at: 20000,
      action: 'filterByPerson',
      data: { email: DEMO_TEAM[2].email },
      description: 'Filter to show only Elena\'s activity',
    },
  ],
};

/**
 * Scenario 3: Full Overview
 * Duration: ~30 seconds
 * 
 * Complete tour of GitSpectra features.
 * Good for website hero video.
 */
export const SCENARIO_FULL_OVERVIEW: DemoScenario = {
  id: 'full-overview',
  name: 'Full Feature Overview',
  description: 'Complete tour of all GitSpectra features',
  duration: 30000,
  events: [
    // Start with Activity Feed
    {
      at: 0,
      action: 'showActivityFeed',
    },
    {
      at: 1000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[0],
        message: 'Refactor authentication flow for better security',
        files: [
          { path: 'src/hooks/useAuth.ts', status: 'modified' },
          { path: 'src/services/auth.ts', status: 'modified' },
        ],
        branch: 'origin/main',
      },
    },
    {
      at: 3000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[2],
        message: 'Add dark mode support to settings page',
        files: [{ path: 'src/pages/Settings.tsx', status: 'modified' }],
        branch: 'origin/feature/dark-mode',
      },
    },
    // Switch to editor with conflict
    {
      at: 6000,
      action: 'focusEditor',
      data: { file: 'src/hooks/useAuth.ts', line: 25 },
    },
    {
      at: 7500,
      action: 'injectConflict',
      data: {
        file: 'src/hooks/useAuth.ts',
        lines: { start: 28, end: 35 },
        severity: 'hard',
        author: DEMO_TEAM[0],
        message: 'Refactor authentication flow for better security',
        branch: 'origin/main',
      },
    },
    // Show hover details
    {
      at: 10000,
      action: 'showHover',
      data: { line: 30 },
    },
    // More activity
    {
      at: 13000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[1],
        message: 'Implement retry logic for failed requests',
        files: [{ path: 'src/services/api.ts', status: 'modified' }],
        branch: 'origin/main',
      },
    },
    // Show conflict panel
    {
      at: 16000,
      action: 'showConflictPanel',
    },
    // Add another conflict
    {
      at: 18000,
      action: 'injectConflict',
      data: {
        file: 'src/services/api.ts',
        lines: { start: 55, end: 60 },
        severity: 'soft',
        author: DEMO_TEAM[1],
        message: 'Implement retry logic for failed requests',
        branch: 'origin/main',
      },
    },
    // Final activity burst
    {
      at: 21000,
      action: 'showActivityFeed',
    },
    {
      at: 22000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[5], // Priya Sharma
        message: 'Fix memory leak in event listeners',
        files: [{ path: 'src/hooks/useWebSocket.ts', status: 'modified' }],
        branch: 'origin/hotfix/memory-leak',
      },
    },
    {
      at: 24000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[4],
        message: 'Add unit tests for payment processor',
        files: [{ path: 'src/services/payment.test.ts', status: 'added' }],
        branch: 'origin/main',
      },
    },
  ],
};

/**
 * Scenario 4: Privacy Focus
 * Duration: ~15 seconds
 * 
 * Emphasizes the local-only, privacy-first nature.
 */
export const SCENARIO_PRIVACY: DemoScenario = {
  id: 'privacy',
  name: 'Privacy & Security Demo',
  description: 'Highlights the 100% local operation - no cloud, no tracking',
  duration: 15000,
  events: [
    {
      at: 0,
      action: 'showConflictPanel',
    },
    {
      at: 2000,
      action: 'injectConflict',
      data: {
        file: 'src/components/Dashboard.tsx',
        lines: { start: 45, end: 52 },
        severity: 'hard',
        author: DEMO_TEAM[0],
        message: 'Update dashboard layout',
        branch: 'origin/main',
      },
    },
    {
      at: 5000,
      action: 'showNotification',
      data: { 
        message: '🔒 GitSpectra: Detected 1 conflict (100% local - no data sent to cloud)' 
      },
    },
    {
      at: 10000,
      action: 'showActivityFeed',
    },
    {
      at: 11000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[1],
        message: 'All activity detected via local git fetch - your code never leaves your machine',
        files: [{ path: 'src/services/auth.ts', status: 'modified' }],
        branch: 'origin/main',
      },
    },
  ],
};

/**
 * Scenario 5: Rapid Activity (for looping background video)
 * Duration: ~15 seconds, designed to loop seamlessly
 */
export const SCENARIO_LOOP_ACTIVITY: DemoScenario = {
  id: 'loop-activity',
  name: 'Looping Activity Demo',
  description: 'Continuous activity feed for background/looping video',
  duration: 15000,
  loop: true,
  events: [
    { at: 0, action: 'showActivityFeed' },
    {
      at: 1000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[0],
        message: 'Refactor authentication flow',
        files: [{ path: 'src/hooks/useAuth.ts', status: 'modified' }],
        branch: 'origin/main',
      },
    },
    {
      at: 3500,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[1],
        message: 'Fix race condition in WebSocket',
        files: [{ path: 'src/hooks/useWebSocket.ts', status: 'modified' }],
        branch: 'origin/main',
      },
    },
    {
      at: 6000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[2],
        message: 'Add loading states to dashboard',
        files: [{ path: 'src/components/Dashboard.tsx', status: 'modified' }],
        branch: 'origin/feature/dashboard-v2',
      },
    },
    {
      at: 8500,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[3],
        message: 'Update API response types',
        files: [{ path: 'src/types/user.ts', status: 'modified' }],
        branch: 'origin/main',
      },
    },
    {
      at: 11000,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[4],
        message: 'Optimize database queries',
        files: [{ path: 'src/services/auth.ts', status: 'modified' }],
        branch: 'origin/main',
      },
    },
    {
      at: 13500,
      action: 'injectActivity',
      data: {
        author: DEMO_TEAM[5],
        message: 'Fix memory leak in listeners',
        files: [{ path: 'src/hooks/useWebSocket.ts', status: 'modified' }],
        branch: 'origin/hotfix/memory-leak',
      },
    },
  ],
};

/**
 * All available scenarios
 */
export const ALL_SCENARIOS: DemoScenario[] = [
  SCENARIO_CONFLICT_DETECTION,
  SCENARIO_ACTIVITY_FEED,
  SCENARIO_FULL_OVERVIEW,
  SCENARIO_PRIVACY,
  SCENARIO_LOOP_ACTIVITY,
];

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): DemoScenario | undefined {
  return ALL_SCENARIOS.find(s => s.id === id);
}

