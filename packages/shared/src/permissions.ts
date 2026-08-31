/**
 * Permissions, safer execution, and tool access control.
 */

export type PermissionLevel = 'allow' | 'deny' | 'confirm';

export interface ToolPermission {
  tool: string;
  level: PermissionLevel;
  pattern?: string; // optional command/path pattern
  reason?: string;
}

export interface ExecutionPolicy {
  readOnly: boolean;
  allowList: string[]; // globs or tool names that are always allowed
  denyList: string[]; // globs or patterns that are always denied
  requireConfirm: string[]; // tools that always need confirmation
  timeoutMs: number;
  maxOutputBytes: number;
  toolPermissions: ToolPermission[];
}

export interface RiskAssessment {
  risk: 'safe' | 'caution' | 'destructive';
  reason?: string;
  requiresConfirm: boolean;
  blocked: boolean;
}

export const DEFAULT_POLICY: ExecutionPolicy = {
  readOnly: false,
  allowList: ['read_file', 'list_files', 'search_text', 'workspace_info', 'git_status'],
  denyList: [],
  requireConfirm: ['write_file', 'patch_file', 'run_command'],
  timeoutMs: 120_000,
  maxOutputBytes: 200 * 1024,
  toolPermissions: [],
};

export function evaluatePermission(
  toolName: string,
  input: unknown,
  policy: ExecutionPolicy,
): RiskAssessment {
  // Check explicit deny list first
  for (const perm of policy.toolPermissions) {
    if (perm.tool === toolName || perm.tool === '*') {
      if (perm.level === 'deny') {
        return { risk: 'destructive', reason: perm.reason ?? `Denied by policy: ${perm.tool}`, requiresConfirm: false, blocked: true };
      }
      if (perm.level === 'confirm') {
        return { risk: 'caution', reason: perm.reason ?? `Requires confirmation: ${toolName}`, requiresConfirm: true, blocked: false };
      }
    }
  }
  if (policy.readOnly && ['write_file', 'patch_file', 'run_command'].includes(toolName)) {
    return { risk: 'destructive', reason: 'Read-only mode active', requiresConfirm: false, blocked: true };
  }
  if (policy.denyList.includes(toolName)) {
    return { risk: 'destructive', reason: `Tool ${toolName} is in deny list`, requiresConfirm: false, blocked: true };
  }
  if (policy.requireConfirm.includes(toolName)) {
    return { risk: 'caution', reason: `Tool ${toolName} requires confirmation`, requiresConfirm: true, blocked: false };
  }
  return { risk: 'safe', requiresConfirm: false, blocked: false };
}
