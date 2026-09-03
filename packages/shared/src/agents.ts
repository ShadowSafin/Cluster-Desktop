/**
 * Multi-agent definitions for Phase 2.
 *
 * Each agent has distinct responsibilities and tool access boundaries.
 */

import type { Task, AgentRole } from './tasks.js';

// AgentRole is defined in tasks.ts and re-exported via shared index

export interface AgentDefinition {
  role: AgentRole;
  name: string;
  description: string;
  /** Tools this agent is allowed to use. Empty means all. */
  allowedTools: string[];
  /** Tools this agent is explicitly denied. */
  deniedTools?: string[];
  /** System prompt fragment for this agent. */
  systemPrompt: string;
  /** Whether this agent can run in parallel with others. */
  parallelizable: boolean;
  /** Maximum concurrent instances of this agent. */
  maxConcurrency: number;
  modelOverride?: string;
}

export interface AgentActivity {
  agentRole: AgentRole;
  agentId: string;
  taskId?: string;
  phase: 'idle' | 'thinking' | 'acting' | 'waiting' | 'done' | 'error';
  message: string;
  timestamp: string;
  toolCallId?: string;
}

export interface AgentResult {
  agentRole: AgentRole;
  taskId: string;
  success: boolean;
  summary: string;
  artifacts?: Array<{ type: string; path?: string; content?: string }>;
  error?: string;
  durationMs: number;
}

export interface SubAgentState {
  id: string;
  sessionId: string;
  name: string;
  role: AgentRole;
  status: 'spawning' | 'running' | 'waiting' | 'reported' | 'done' | 'failed';
  phase?: 'planning' | 'researching' | 'coding' | 'reviewing' | 'testing' | 'merging';
  currentTask?: string;
  taskId?: string;
  progress: number;
  message?: string;
  summary?: string;
  output?: string;
  filesAssigned?: string[];
  filesModified?: string[];
  startedAt?: string;
  finishedAt?: string;
}

export interface SubAgentHandoff {
  id: string;
  sessionId: string;
  fromAgentId: string;
  fromAgentName: string;
  fromRole: AgentRole;
  toAgentId: string;
  action: 'delegated' | 'started' | 'reported' | 'reviewed' | 'merged' | 'rejected';
  taskTitle: string;
  resultSummary?: string;
  filesTouched?: string[];
  timestamp: string;
}

export interface SubAgentSwarmSummary {
  goal: string;
  coordinatorNotes: string;
  subAgentsCount: number;
  subAgents: Array<{
    name: string;
    role: AgentRole;
    tasksCompleted: number;
    filesModified: string[];
    summary: string;
  }>;
  filesChanged: string[];
  decisions: string[];
  verification: {
    passed: boolean;
    summary: string;
  };
  caveats?: string[];
  totalDurationMs: number;
}

export const AGENT_DEFINITIONS: Record<AgentRole, AgentDefinition> = {
  planner: {
    role: 'planner',
    name: 'Planner',
    description: 'Breaks requests into structured task graphs with dependencies',
    allowedTools: ['workspace_info', 'list_files', 'read_file', 'search_text', 'git_status'],
    parallelizable: false,
    maxConcurrency: 1,
    systemPrompt: [
      'You are the Planner agent. Your job is to break down complex requests into a clear task graph.',
      '- Create parent tasks and subtasks with explicit dependencies.',
      '- Identify which tasks can run in parallel vs sequentially.',
      '- Assign each task to the appropriate specialist agent.',
      '- Keep tasks focused: one agent, one responsibility per task.',
      '- Output a JSON task graph with tasks, dependencies, and agent assignments.',
    ].join('\n'),
  },
  coder: {
    role: 'coder',
    name: 'Coder',
    description: 'Performs file edits and implementation work',
    allowedTools: ['read_file', 'list_files', 'search_text', 'write_file', 'patch_file', 'git_status', 'workspace_info'],
    parallelizable: true,
    maxConcurrency: 3,
    systemPrompt: [
      'You are the Coder agent. You implement code changes precisely.',
      '- Read files before editing them.',
      '- Prefer patch_file for surgical edits to existing files.',
      '- Make the smallest change that solves the task.',
      '- Do not run tests or verification; that is the Tester role.',
    ].join('\n'),
  },
  reviewer: {
    role: 'reviewer',
    name: 'Reviewer',
    description: 'Inspects code changes and flags issues',
    allowedTools: ['read_file', 'list_files', 'search_text', 'git_status'],
    parallelizable: true,
    maxConcurrency: 2,
    systemPrompt: [
      'You are the Reviewer agent. You inspect code changes for correctness.',
      '- Read the changed files and surrounding context.',
      '- Flag bugs, style issues, missing error handling, and security concerns.',
      '- Suggest concrete improvements with file/line references.',
      '- Do not make edits yourself; report findings.',
    ].join('\n'),
  },
  tester: {
    role: 'tester',
    name: 'Tester',
    description: 'Runs tests, lint, and build verification',
    allowedTools: ['run_command', 'read_file', 'list_files', 'workspace_info'],
    parallelizable: true,
    maxConcurrency: 2,
    systemPrompt: [
      'You are the Tester agent. You verify changes by running checks.',
      '- Discover relevant test commands from the workspace.',
      '- Run targeted tests, not the full suite unless needed.',
      '- Parse failures and produce actionable summaries.',
      '- Attempt auto-fixes for lint/format issues when safe.',
    ].join('\n'),
  },
  context: {
    role: 'context',
    name: 'Context',
    description: 'Gathers relevant repo information and selects files',
    allowedTools: ['workspace_info', 'list_files', 'read_file', 'search_text', 'git_status'],
    deniedTools: ['write_file', 'patch_file', 'run_command'],
    parallelizable: true,
    maxConcurrency: 2,
    systemPrompt: [
      'You are the Context agent. You gather repository intelligence.',
      '- Use smart file ranking and chunking to select relevant files.',
      '- Extract symbols, summarize large files, and detect recent changes.',
      '- Minimize token waste by returning only the most relevant context.',
      '- Do not make edits or run commands.',
    ].join('\n'),
  },
  researcher: {
    role: 'researcher',
    name: 'Researcher',
    description: 'Investigates codebase structure, packages, dependencies, and patterns',
    allowedTools: ['workspace_info', 'list_files', 'read_file', 'search_text', 'git_status'],
    deniedTools: ['write_file', 'patch_file', 'run_command'],
    parallelizable: true,
    maxConcurrency: 3,
    systemPrompt: [
      'You are the Researcher agent. You inspect and analyze the codebase without making edits.',
      '- Discover directory layouts, package manifests, and code conventions.',
      '- Read relevant source files and report concise, actionable findings to the coordinator and builders.',
      '- Do not edit files or run build commands.',
    ].join('\n'),
  },
  'ui-builder': {
    role: 'ui-builder',
    name: 'UI Builder',
    description: 'Specializes in user interfaces, components, layouts, Tailwind CSS, and styling',
    allowedTools: ['read_file', 'list_files', 'search_text', 'write_file', 'patch_file', 'workspace_info'],
    parallelizable: true,
    maxConcurrency: 2,
    systemPrompt: [
      'You are the UI Builder agent. You design and implement beautiful, accessible, responsive interfaces.',
      '- Read existing component files to match styling conventions and design patterns.',
      '- Use Tailwind CSS cleanly with proper flex/grid containment to prevent overlaps.',
      '- Ensure clean states, responsive constraints, and pristine component layouts.',
    ].join('\n'),
  },
  'backend-builder': {
    role: 'backend-builder',
    name: 'Backend Builder',
    description: 'Specializes in APIs, server logic, IPC handlers, data models, and storage',
    allowedTools: ['read_file', 'list_files', 'search_text', 'write_file', 'patch_file', 'workspace_info'],
    parallelizable: true,
    maxConcurrency: 2,
    systemPrompt: [
      'You are the Backend Builder agent. You implement robust backend logic, APIs, and data models.',
      '- Write type-safe handlers, error handling, and robust storage interactions.',
      '- Follow established architecture patterns without breaking existing contracts.',
    ].join('\n'),
  },
  coordinator: {
    role: 'coordinator',
    name: 'Coordinator',
    description: 'Manages task assignment, subagent coordination, and merges results',
    allowedTools: ['workspace_info', 'list_files', 'read_file', 'search_text', 'git_status', 'write_file', 'patch_file', 'run_command'],
    parallelizable: false,
    maxConcurrency: 1,
    systemPrompt: [
      'You are the Coordinator agent. You orchestrate the other agents.',
      '- Assign tasks to the right specialist based on the task graph.',
      '- Detect and resolve conflicting edits.',
      '- Merge results and ensure the final output is coherent.',
      '- Every agent action must be visible and traceable.',
    ].join('\n'),
  },
};

export function allowedToolsForRole(role: AgentRole): string[] {
  return AGENT_DEFINITIONS[role].allowedTools;
}

export function canUseTool(role: AgentRole, toolName: string): boolean {
  const def = AGENT_DEFINITIONS[role];
  if (def.deniedTools?.includes(toolName)) return false;
  if (def.allowedTools.length === 0) return true;
  return def.allowedTools.includes(toolName);
}

export function isParallelizable(role: AgentRole): boolean {
  return AGENT_DEFINITIONS[role].parallelizable;
}
