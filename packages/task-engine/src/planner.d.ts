import { type TaskGraph, type AgentRole } from '@cluster/shared';
export interface PlannerInput {
    goal: string;
    workspace?: {
        projectKind?: string;
        packageManager?: string | null;
        languages?: string[];
    };
    /** Optional hints from context engine. */
    fileGroups?: Array<{
        area: string;
        files: string[];
    }>;
}
export interface PlannedTask {
    title: string;
    description?: string;
    agentRole: AgentRole;
    dependsOn?: number[];
    priority?: 'low' | 'normal' | 'high' | 'critical';
    complexity?: number;
}
/**
 * Planner agent: breaks request into steps and subtasks.
 *
 * Two modes:
 * - heuristic: local rule-based planning without LLM (fallback, deterministic)
 * - llm: structured JSON planning (called via provider)
 *
 * This module implements the heuristic planner; the coordinator may replace
 * it with an LLM-generated graph after validation.
 */
export declare class TaskPlanner {
    /** Heuristic planning without LLM — fast and deterministic. */
    planHeuristic(input: PlannerInput): TaskGraph;
    /** Validate and normalize an LLM-produced plan. */
    validateAndCreateGraph(goal: string, planned: PlannedTask[]): TaskGraph;
    private inferSteps;
    /** Create a task graph from LLM JSON output (for provider-based planning). */
    parseLLMPlan(goal: string, json: string): TaskGraph;
    private inferRole;
}
export declare function createPlanner(): TaskPlanner;
//# sourceMappingURL=planner.d.ts.map