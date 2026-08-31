import type { WorkspaceInfo } from '@cluster/shared';
/**
 * Build a snapshot of the workspace.
 *
 * This is the only place that assembles `WorkspaceInfo`, so the agent, the TUI
 * and the session store all see exactly the same picture of the repository.
 */
export declare function loadWorkspaceInfo(root: string): Promise<WorkspaceInfo>;
/** Compact block injected into the agent's system prompt. */
export declare function formatWorkspaceContext(info: WorkspaceInfo): string;
/** One-line summary for the status bar. */
export declare function formatWorkspaceHeadline(info: WorkspaceInfo): string;
//# sourceMappingURL=context.d.ts.map