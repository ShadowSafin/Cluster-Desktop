/**
 * Permissions, safer execution, and tool access control.
 */
export type PermissionLevel = 'allow' | 'deny' | 'confirm';
export interface ToolPermission {
    tool: string;
    level: PermissionLevel;
    pattern?: string;
    reason?: string;
}
export interface ExecutionPolicy {
    readOnly: boolean;
    allowList: string[];
    denyList: string[];
    requireConfirm: string[];
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
export declare const DEFAULT_POLICY: ExecutionPolicy;
export declare function evaluatePermission(toolName: string, input: unknown, policy: ExecutionPolicy): RiskAssessment;
//# sourceMappingURL=permissions.d.ts.map