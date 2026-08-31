/**
 * Permissions, safer execution, and tool access control.
 */
export const DEFAULT_POLICY = {
    readOnly: false,
    allowList: ['read_file', 'list_files', 'search_text', 'workspace_info', 'git_status'],
    denyList: [],
    requireConfirm: ['write_file', 'patch_file', 'run_command'],
    timeoutMs: 120_000,
    maxOutputBytes: 200 * 1024,
    toolPermissions: [],
};
export function evaluatePermission(toolName, input, policy) {
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
//# sourceMappingURL=permissions.js.map