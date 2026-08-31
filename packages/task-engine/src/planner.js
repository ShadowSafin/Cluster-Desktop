import { TaskGraphStore } from './graph.js';
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
export class TaskPlanner {
    /** Heuristic planning without LLM — fast and deterministic. */
    planHeuristic(input) {
        const store = TaskGraphStore.create(input.goal);
        const steps = this.inferSteps(input);
        // Map from step index to task id for dependency wiring
        const ids = [];
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const dependsOn = (step.dependsOn ?? []).map((idx) => ids[idx]).filter(Boolean);
            const task = store.addTask({
                title: step.title,
                description: step.description,
                agentRole: step.agentRole,
                dependsOn,
                priority: step.priority,
                complexity: step.complexity,
            });
            ids.push(task.id);
        }
        // If goal implies multiple areas, add subtask grouping
        if (input.fileGroups && input.fileGroups.length > 1) {
            for (const group of input.fileGroups) {
                const parent = store.addTask({
                    title: `Work on ${group.area}`,
                    agentRole: 'coder',
                    priority: 'normal',
                });
                for (const file of group.files.slice(0, 3)) {
                    store.addTask({
                        title: `Update ${file}`,
                        description: `Part of: ${group.area}`,
                        parentId: parent.id,
                        agentRole: 'coder',
                        dependsOn: [],
                    });
                }
            }
        }
        return store.graph;
    }
    /** Validate and normalize an LLM-produced plan. */
    validateAndCreateGraph(goal, planned) {
        const store = TaskGraphStore.create(goal);
        const ids = [];
        for (const step of planned) {
            const dependsOn = (step.dependsOn ?? []).map((idx) => ids[idx]).filter(Boolean);
            const task = store.addTask({
                title: step.title.slice(0, 120),
                description: step.description?.slice(0, 500),
                agentRole: step.agentRole,
                dependsOn,
                priority: step.priority ?? 'normal',
                complexity: step.complexity ?? 2,
            });
            ids.push(task.id);
        }
        // Validate no cycles
        const order = store.topologicalOrder();
        if (!order.ok) {
            throw new Error(`Planner produced cyclic graph: ${order.error}`);
        }
        return store.graph;
    }
    inferSteps(input) {
        const goal = input.goal.toLowerCase();
        const steps = [];
        // Always start with context gathering
        steps.push({
            title: 'Gather context and analyze request',
            description: `Analyze: ${input.goal.slice(0, 200)}`,
            agentRole: 'context',
            priority: 'high',
            complexity: 1,
        });
        // Detect intent categories
        const needsCoding = /fix|implement|add|create|build|refactor|update|change|edit/.test(goal);
        const needsTests = /test|verify|check|lint|build|typecheck/.test(goal) || needsCoding;
        const needsReview = needsCoding;
        const isComplex = input.goal.split(/\s+/).length > 20 || /and|also|then|multiple|several/.test(goal);
        const needsPlanning = isComplex || goal.includes('complex') || goal.length > 100;
        if (needsCoding) {
            if (isComplex) {
                steps.push({
                    title: 'Break down implementation into subtasks',
                    agentRole: 'planner',
                    dependsOn: [0],
                    priority: 'high',
                    complexity: 2,
                });
                steps.push({
                    title: 'Implement core changes',
                    agentRole: 'coder',
                    dependsOn: [steps.length - 1 ? steps.length : 1],
                    priority: 'high',
                    complexity: 3,
                });
                // Second coder task can run in parallel if independent
                if (input.fileGroups && input.fileGroups.length > 1) {
                    steps.push({
                        title: 'Implement secondary changes (parallel)',
                        agentRole: 'coder',
                        dependsOn: [1], // depends on planning, not on first coder task -> parallel
                        priority: 'normal',
                        complexity: 3,
                    });
                }
            }
            else {
                steps.push({
                    title: 'Implement requested changes',
                    agentRole: 'coder',
                    dependsOn: [0],
                    priority: 'high',
                    complexity: 3,
                });
            }
        }
        if (needsReview) {
            const coderIdx = steps.findIndex((s) => s.agentRole === 'coder');
            steps.push({
                title: 'Review code changes',
                agentRole: 'reviewer',
                dependsOn: coderIdx >= 0 ? [coderIdx] : [0],
                priority: 'normal',
                complexity: 2,
            });
        }
        if (needsTests) {
            const reviewIdx = steps.findIndex((s) => s.agentRole === 'reviewer');
            const coderIdx = steps.findIndex((s) => s.agentRole === 'coder');
            const dep = reviewIdx >= 0 ? reviewIdx : coderIdx >= 0 ? coderIdx : 0;
            steps.push({
                title: 'Run verification and tests',
                agentRole: 'tester',
                dependsOn: [dep],
                priority: 'high',
                complexity: 2,
            });
        }
        // Ensure at least 2 steps for non-trivial goals
        if (steps.length === 1 && input.goal.length > 30) {
            steps.push({
                title: 'Execute and verify',
                agentRole: 'coder',
                dependsOn: [0],
                priority: 'normal',
            });
        }
        return steps;
    }
    /** Create a task graph from LLM JSON output (for provider-based planning). */
    parseLLMPlan(goal, json) {
        try {
            const data = JSON.parse(json);
            if (!data.steps || !Array.isArray(data.steps))
                throw new Error('Missing steps array');
            const planned = data.steps.map((s, idx) => ({
                title: s.text,
                agentRole: this.inferRole(s.text, s.agent),
                dependsOn: idx > 0 ? [idx - 1] : [],
                priority: idx === 0 ? 'high' : 'normal',
            }));
            return this.validateAndCreateGraph(data.goal ?? goal, planned);
        }
        catch (error) {
            // Fallback to heuristic on parse failure
            return this.planHeuristic({ goal });
        }
    }
    inferRole(text, hint) {
        if (hint && ['planner', 'coder', 'reviewer', 'tester', 'context', 'coordinator'].includes(hint)) {
            return hint;
        }
        const lower = text.toLowerCase();
        if (/plan|break down|decompose/.test(lower))
            return 'planner';
        if (/test|verify|lint|build|check/.test(lower))
            return 'tester';
        if (/review|inspect|audit/.test(lower))
            return 'reviewer';
        if (/context|gather|search|find|locate/.test(lower))
            return 'context';
        return 'coder';
    }
}
export function createPlanner() {
    return new TaskPlanner();
}
//# sourceMappingURL=planner.js.map