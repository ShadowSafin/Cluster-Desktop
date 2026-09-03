import { createId, type TaskGraph, type AgentRole } from '@cluster/shared';
import { TaskGraphStore } from './graph.js';

export interface PlannerInput {
  goal: string;
  workspace?: {
    projectKind?: string;
    packageManager?: string | null;
    languages?: string[];
  };
  /** Optional hints from context engine. */
  fileGroups?: Array<{ area: string; files: string[] }>;
}

export interface PlannedTask {
  title: string;
  description?: string;
  agentRole: AgentRole;
  dependsOn?: number[]; // indices of planned tasks
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
export class TaskPlanner {
  /** Heuristic planning without LLM — fast and deterministic. */
  planHeuristic(input: PlannerInput): TaskGraph {
    const store = TaskGraphStore.create(input.goal);
    const steps = this.inferSteps(input);

    // Map from step index to task id for dependency wiring
    const ids: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const dependsOn = (step.dependsOn ?? []).map((idx) => ids[idx]!).filter(Boolean);
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
  validateAndCreateGraph(goal: string, planned: PlannedTask[]): TaskGraph {
    const store = TaskGraphStore.create(goal);
    const ids: string[] = [];

    for (const step of planned) {
      const dependsOn = (step.dependsOn ?? []).map((idx) => ids[idx]!).filter(Boolean);
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

  private inferSteps(input: PlannerInput): PlannedTask[] {
    const goal = input.goal.toLowerCase();
    const steps: PlannedTask[] = [];
    const isComplex = input.goal.split(/\s+/).length > 15 || /and|also|then|multiple|several|full|system/.test(goal);

    // Always start with context & research gathering
    const needsResearch = /analyze|research|audit|inspect|explore|find|investigate/.test(goal) || isComplex;
    steps.push({
      title: 'Analyze workspace and discover code patterns',
      description: `Analyze: ${input.goal.slice(0, 200)}`,
      agentRole: needsResearch ? 'researcher' : 'context',
      priority: 'high',
      complexity: 1,
    });

    // Detect intent categories
    const needsUI = /ui|component|page|screen|button|view|layout|css|tailwind|style|modal|dialog|card|sidebar|header|tab/.test(goal);
    const needsBackend = /api|server|backend|ipc|database|sqlite|route|endpoint|store|storage|socket|process/.test(goal);
    const needsCoding = /fix|implement|add|create|build|refactor|update|change|edit/.test(goal) || needsUI || needsBackend;
    const needsTests = /test|verify|check|lint|build|typecheck/.test(goal) || needsCoding;
    const needsReview = needsCoding;

    if (needsCoding) {
      if (isComplex && (needsUI || needsBackend)) {
        steps.push({
          title: 'Plan architecture and task dependencies',
          agentRole: 'planner',
          dependsOn: [0],
          priority: 'high',
          complexity: 2,
        });

        const planIdx = steps.length - 1;

        if (needsUI) {
          steps.push({
            title: 'Build UI components and layout styling',
            agentRole: 'ui-builder',
            dependsOn: [planIdx], // runs in parallel with backend builder
            priority: 'high',
            complexity: 3,
          });
        }

        if (needsBackend) {
          steps.push({
            title: 'Implement backend services and data logic',
            agentRole: 'backend-builder',
            dependsOn: [planIdx], // runs in parallel with UI builder
            priority: 'high',
            complexity: 3,
          });
        }

        if (!needsUI && !needsBackend) {
          steps.push({
            title: 'Implement core application features',
            agentRole: 'coder',
            dependsOn: [planIdx],
            priority: 'high',
            complexity: 3,
          });
        }
      } else if (isComplex) {
        steps.push({
          title: 'Break down implementation into subtasks',
          agentRole: 'planner',
          dependsOn: [0],
          priority: 'high',
          complexity: 2,
        });
        steps.push({
          title: 'Implement primary feature logic',
          agentRole: 'coder',
          dependsOn: [steps.length - 1],
          priority: 'high',
          complexity: 3,
        });
        if (input.fileGroups && input.fileGroups.length > 1) {
          steps.push({
            title: 'Implement auxiliary components in parallel',
            agentRole: 'coder',
            dependsOn: [1], // parallel with primary coder
            priority: 'normal',
            complexity: 3,
          });
        }
      } else {
        steps.push({
          title: needsUI ? 'Build UI interface' : needsBackend ? 'Implement service logic' : 'Implement requested changes',
          agentRole: needsUI ? 'ui-builder' : needsBackend ? 'backend-builder' : 'coder',
          dependsOn: [0],
          priority: 'high',
          complexity: 3,
        });
      }
    }

    if (needsReview) {
      const builderIndices = steps
        .map((s, idx) => ({ role: s.agentRole, idx }))
        .filter((s) => s.role === 'coder' || s.role === 'ui-builder' || s.role === 'backend-builder')
        .map((s) => s.idx);
      steps.push({
        title: 'Review implementation diffs and verify code standards',
        agentRole: 'reviewer',
        dependsOn: builderIndices.length > 0 ? builderIndices : [0],
        priority: 'normal',
        complexity: 2,
      });
    }

    if (needsTests) {
      const reviewIdx = steps.findIndex((s) => s.agentRole === 'reviewer');
      const builderIndices = steps
        .map((s, idx) => ({ role: s.agentRole, idx }))
        .filter((s) => s.role === 'coder' || s.role === 'ui-builder' || s.role === 'backend-builder')
        .map((s) => s.idx);
      const dep = reviewIdx >= 0 ? [reviewIdx] : builderIndices.length > 0 ? builderIndices : [0];
      steps.push({
        title: 'Run test suite and verify build diagnostics',
        agentRole: 'tester',
        dependsOn: dep,
        priority: 'high',
        complexity: 2,
      });
    }

    // Ensure at least 2 steps for non-trivial goals
    if (steps.length === 1 && input.goal.length > 30) {
      steps.push({
        title: 'Execute implementation plan',
        agentRole: 'coder',
        dependsOn: [0],
        priority: 'normal',
      });
    }

    return steps;
  }

  /** Create a task graph from LLM JSON output (for provider-based planning). */
  parseLLMPlan(goal: string, json: string): TaskGraph {
    try {
      const data = JSON.parse(json) as { goal?: string; steps?: Array<{ text: string; agent?: string }> };
      if (!data.steps || !Array.isArray(data.steps)) throw new Error('Missing steps array');
      const planned: PlannedTask[] = data.steps.map((s, idx) => ({
        title: s.text,
        agentRole: this.inferRole(s.text, s.agent),
        dependsOn: idx > 0 ? [idx - 1] : [],
        priority: idx === 0 ? 'high' : 'normal',
      }));
      return this.validateAndCreateGraph(data.goal ?? goal, planned);
    } catch (error) {
      // Fallback to heuristic on parse failure
      return this.planHeuristic({ goal });
    }
  }

  private inferRole(text: string, hint?: string): AgentRole {
    if (hint && ['planner', 'coder', 'reviewer', 'tester', 'context', 'coordinator'].includes(hint)) {
      return hint as AgentRole;
    }
    const lower = text.toLowerCase();
    if (/plan|break down|decompose/.test(lower)) return 'planner';
    if (/test|verify|lint|build|check/.test(lower)) return 'tester';
    if (/review|inspect|audit/.test(lower)) return 'reviewer';
    if (/context|gather|search|find|locate/.test(lower)) return 'context';
    return 'coder';
  }
}

export function createPlanner(): TaskPlanner {
  return new TaskPlanner();
}
