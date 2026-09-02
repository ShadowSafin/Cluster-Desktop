/**
 * Core Skill Definitions & Manifest Specification for Cluster.
 */

export type SkillCategory =
  | 'coding'
  | 'refactor'
  | 'review'
  | 'debugging'
  | 'docs'
  | 'ui'
  | 'electron'
  | 'memory'
  | 'provider'
  | 'workflow'
  | 'automation'
  | 'planning'
  | 'testing'
  | 'deployment'
  | 'project_setup'
  | 'migration';

export type SkillEntryType = 'prompt' | 'workflow' | 'tool' | 'composite';

export type SkillPermission =
  | 'fs:read'
  | 'fs:write'
  | 'cmd:exec'
  | 'memory'
  | 'network'
  | 'workspace';

export interface SkillParamDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  description: string;
  required?: boolean;
  default?: any;
}

export interface SkillWorkflowStep {
  id: string;
  title: string;
  role?: string;
  tool?: string;
  action: string;
  required?: boolean;
}

export interface SkillSecurityFlags {
  isVerified: boolean;
  isSafe: boolean;
  communityReviewed?: boolean;
}

export interface SkillStats {
  downloads: number;
  rating: number; // 0.0 - 5.0
  invocations: number;
}

export interface SkillManifest {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  category: SkillCategory;
  entryType: SkillEntryType;
  invocationName: string; // e.g. "refactor" triggered by /refactor
  supportedCommands?: string[]; // e.g. ['/refactor', '/refactor-clean']
  requiredPermissions: SkillPermission[];
  requiredTools: string[];
  modelCompatibility?: string[] | 'all';
  installSource: 'builtin' | 'marketplace' | 'custom';
  instructions: string;
  workflow?: SkillWorkflowStep[];
  defaultParams?: SkillParamDefinition[];
  securityFlags: SkillSecurityFlags;
  stats: SkillStats;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstalledSkill {
  manifest: SkillManifest;
  enabled: boolean;
  pinned: boolean;
  installedAt: string;
  updatedAt: string;
  lastInvokedAt?: string;
  invocationCount: number;
  userParams?: Record<string, any>;
}

export interface SkillInvocationRecord {
  id: string;
  skillId: string;
  skillName: string;
  invocationName: string;
  sessionId: string;
  params: Record<string, any>;
  rawCommand: string;
  invokedAt: string;
  status: 'success' | 'failed' | 'cancelled';
  error?: string;
}

export interface SkillFilterOptions {
  category?: SkillCategory | 'all';
  search?: string;
  tag?: string;
  author?: string;
  source?: 'all' | 'builtin' | 'marketplace' | 'custom';
  installedOnly?: boolean;
  sortBy?: 'popularity' | 'rating' | 'name' | 'recent';
}
