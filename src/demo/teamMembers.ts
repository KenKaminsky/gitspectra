/**
 * Demo Team Members
 * 
 * Fake team member profiles for demo scenarios.
 * These create a realistic-looking team for marketing videos.
 */

import type { DemoTeamMember } from './types.js';

// Gravatar hash helper - generates consistent avatar URLs
function gravatarUrl(email: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=80`;
}

/**
 * Demo team - diverse, professional-looking team for marketing
 */
export const DEMO_TEAM: DemoTeamMember[] = [
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@acme.dev',
    githubUsername: 'sarahchen',
    avatar: gravatarUrl('sarah.chen@acme.dev'),
  },
  {
    name: 'Marcus Johnson',
    email: 'marcus.j@acme.dev',
    githubUsername: 'marcusj',
    avatar: gravatarUrl('marcus.j@acme.dev'),
  },
  {
    name: 'Elena Rodriguez',
    email: 'elena.r@acme.dev',
    githubUsername: 'elenarodriguez',
    avatar: gravatarUrl('elena.r@acme.dev'),
  },
  {
    name: 'Alex Kim',
    email: 'alex.kim@acme.dev',
    githubUsername: 'alexkim',
    avatar: gravatarUrl('alex.kim@acme.dev'),
  },
  {
    name: 'Jordan Taylor',
    email: 'jordan.t@acme.dev',
    githubUsername: 'jordant',
    avatar: gravatarUrl('jordan.t@acme.dev'),
  },
  {
    name: 'Priya Sharma',
    email: 'priya.s@acme.dev',
    githubUsername: 'priyasharma',
    avatar: gravatarUrl('priya.s@acme.dev'),
  },
];

/**
 * Get a random team member
 */
export function getRandomTeamMember(): DemoTeamMember {
  return DEMO_TEAM[Math.floor(Math.random() * DEMO_TEAM.length)];
}

/**
 * Get team member by name
 */
export function getTeamMemberByName(name: string): DemoTeamMember | undefined {
  return DEMO_TEAM.find(m => m.name.toLowerCase().includes(name.toLowerCase()));
}

/**
 * Demo commit messages - realistic-looking commit messages
 */
export const DEMO_COMMIT_MESSAGES = [
  'Refactor authentication flow for better security',
  'Fix race condition in WebSocket handler',
  'Update API response types for v2 endpoints',
  'Add loading states to dashboard components',
  'Optimize database queries for user lookup',
  'Implement retry logic for failed requests',
  'Fix memory leak in event listeners',
  'Update dependencies to latest versions',
  'Add unit tests for payment processor',
  'Refactor notification service',
  'Fix timezone handling in date picker',
  'Improve error messages for form validation',
  'Add dark mode support to settings page',
  'Optimize image loading with lazy load',
  'Fix scroll position reset on navigation',
];

/**
 * Demo file paths - realistic project structure
 */
export const DEMO_FILE_PATHS = [
  'src/components/Dashboard.tsx',
  'src/components/Header.tsx',
  'src/components/Sidebar.tsx',
  'src/hooks/useAuth.ts',
  'src/hooks/useWebSocket.ts',
  'src/services/api.ts',
  'src/services/auth.ts',
  'src/utils/helpers.ts',
  'src/utils/validation.ts',
  'src/types/user.ts',
  'src/pages/Settings.tsx',
  'src/pages/Profile.tsx',
];

/**
 * Demo branch names
 */
export const DEMO_BRANCHES = [
  'origin/main',
  'origin/develop',
  'origin/feature/auth-refactor',
  'origin/feature/dashboard-v2',
  'origin/fix/memory-leak',
  'origin/hotfix/api-timeout',
];

/**
 * Generate a realistic-looking commit hash
 */
export function generateCommitHash(): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 40; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

/**
 * Generate a relative time string
 */
export function relativeTime(minutesAgo: number): Date {
  return new Date(Date.now() - minutesAgo * 60 * 1000);
}

