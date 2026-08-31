import type { RiskLevel } from '@cluster/shared';
import { classifyCommand, classifyPath } from './safety.js';

export type PermissionDecision = 'allow' | 'deny' | 'confirm';

export interface PolicyRule {
  pattern: string | RegExp;
  decision: PermissionDecision;
  /** Human reason shown in UI. */
  reason?: string;
}

export interface ExecutionPolicy {
  /** If true, no mutation is allowed. */
  readOnly: boolean;
  allow: PolicyRule[];
  deny: PolicyRule[];
  /** Tools that always need confirmation regardless of other rules. */
  confirmTools: Set<string>;
  /** Extra confirmation patterns for commands. */
  confirmCommandPatterns: RegExp[];
  perToolPermissions: Map<string, PermissionDecision>;
  defaultDecision: PermissionDecision;
}

export interface RiskEvaluation {
  decision: PermissionDecision;
  risk: RiskLevel;
  reason?: string;
  requiresConfirm: boolean;
  blocked: boolean;
}

export function createDefaultPolicy(options: {
  readOnly?: boolean;
  allow?: PolicyRule[];
  deny?: PolicyRule[];
  confirmTools?: string[];
} = {}): ExecutionPolicy {
  return {
    readOnly: options.readOnly ?? false,
    allow: options.allow ?? [
      { pattern: /^read_file$/, decision: 'allow' },
      { pattern: /^list_files$/, decision: 'allow' },
      { pattern: /^search_text$/, decision: 'allow' },
      { pattern: /^workspace_info$/, decision: 'allow' },
      { pattern: /^git_status$/, decision: 'allow' },
      { pattern: /^git_diff$/, decision: 'allow' },
    ],
    deny: options.deny ?? [],
    confirmTools: new Set(options.confirmTools ?? ['write_file', 'patch_file', 'run_command', 'checkpoint_restore']),
    confirmCommandPatterns: [/rm\s+-rf/, /git\s+push\s+--force/, /git\s+reset\s+--hard/],
    perToolPermissions: new Map(),
    defaultDecision: 'allow',
  };
}

export function evaluateToolPermission(
  toolName: string,
  input: unknown,
  policy: ExecutionPolicy,
): RiskEvaluation {
  // Read-only short-circuit
  if (policy.readOnly && isMutatingTool(toolName)) {
    return { decision: 'deny', risk: 'destructive', reason: 'Read-only mode: mutations are blocked', requiresConfirm: false, blocked: true };
  }

  // Explicit per-tool permission
  const perTool = policy.perToolPermissions.get(toolName);
  if (perTool === 'deny') return { decision: 'deny', risk: 'destructive', reason: `Tool ${toolName} denied by policy`, requiresConfirm: false, blocked: true };
  if (perTool === 'confirm') return { decision: 'confirm', risk: 'caution', reason: `Tool ${toolName} requires confirmation`, requiresConfirm: true, blocked: false };

  // Deny list patterns
  for (const rule of policy.deny) {
    if (matches(rule.pattern, toolName)) {
      return { decision: 'deny', risk: 'destructive', reason: rule.reason ?? `Denied: ${toolName}`, requiresConfirm: false, blocked: true };
    }
  }

  // Mutating command/paths get extra scrutiny
  const risk = inferRisk(toolName, input);
  const requiresConfirm = policy.confirmTools.has(toolName) || risk === 'destructive' || risk === 'caution';

  // Allow list: if explicitly allowed and not risky, we can downgrade confirm
  for (const rule of policy.allow) {
    if (matches(rule.pattern, toolName) && risk === 'safe') {
      return { decision: 'allow', risk, requiresConfirm: false, blocked: false };
    }
  }

  if (requiresConfirm) {
    return { decision: 'confirm', risk, reason: `Tool ${toolName} requires approval (${risk})`, requiresConfirm: true, blocked: false };
  }

  return { decision: policy.defaultDecision, risk, requiresConfirm: false, blocked: false };
}

function matches(pattern: string | RegExp, toolName: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(toolName);
  // Glob-like: allow * wildcard
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(toolName);
}

function isMutatingTool(toolName: string): boolean {
  return ['write_file', 'patch_file', 'run_command', 'checkpoint_restore', 'apply_patch'].includes(toolName);
}

function inferRisk(toolName: string, input: unknown): RiskLevel {
  if (toolName === 'run_command' && input && typeof input === 'object' && 'command' in (input as Record<string, unknown>)) {
    return classifyCommand(String((input as Record<string, unknown>).command)).risk;
  }
  if ((toolName === 'write_file' || toolName === 'patch_file') && input && typeof input === 'object' && 'path' in (input as Record<string, unknown>)) {
    return classifyPath(String((input as Record<string, unknown>).path)).risk;
  }
  if (toolName === 'write_file' || toolName === 'patch_file') return 'caution';
  if (toolName === 'run_command') return 'caution';
  return 'safe';
}

export function setToolPermission(policy: ExecutionPolicy, toolName: string, decision: PermissionDecision): void {
  policy.perToolPermissions.set(toolName, decision);
}

export function setReadOnly(policy: ExecutionPolicy, readOnly: boolean): void {
  policy.readOnly = readOnly;
}
