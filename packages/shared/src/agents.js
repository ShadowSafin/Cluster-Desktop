/**
 * Multi-agent definitions for Phase 2.
 *
 * Each agent has distinct responsibilities and tool access boundaries.
 */
export const AGENT_DEFINITIONS = {
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
    coordinator: {
        role: 'coordinator',
        name: 'Coordinator',
        description: 'Manages task assignment and merges results',
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
export function allowedToolsForRole(role) {
    return AGENT_DEFINITIONS[role].allowedTools;
}
export function canUseTool(role, toolName) {
    const def = AGENT_DEFINITIONS[role];
    if (def.deniedTools?.includes(toolName))
        return false;
    if (def.allowedTools.length === 0)
        return true;
    return def.allowedTools.includes(toolName);
}
export function isParallelizable(role) {
    return AGENT_DEFINITIONS[role].parallelizable;
}
//# sourceMappingURL=agents.js.map