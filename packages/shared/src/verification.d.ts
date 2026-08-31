/**
 * Automatic verification loop types.
 */
export type VerificationKind = 'test' | 'build' | 'lint' | 'format' | 'typecheck' | 'custom';
export interface VerificationCommand {
    kind: VerificationKind;
    command: string;
    cwd?: string;
    /** Glob patterns that trigger this verification. */
    relevantGlobs?: string[];
}
export interface VerificationResult {
    id: string;
    sessionId: string;
    taskId?: string;
    kind: VerificationKind;
    command: string;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
    passed: boolean;
    /** Parsed failures. */
    failures: Array<{
        file?: string;
        line?: number;
        message: string;
    }>;
    /** AI summary of what failed. */
    summary: string;
    attemptedFixes: number;
    autoFixed: boolean;
    createdAt: string;
}
export interface VerificationSummary {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    results: VerificationResult[];
    /** Plain-language summary for the TUI. */
    message: string;
}
export interface VerificationConfig {
    autoRun: boolean;
    maxAutoFixAttempts: number;
    relevantSelection: boolean;
    timeoutMs: number;
}
//# sourceMappingURL=verification.d.ts.map