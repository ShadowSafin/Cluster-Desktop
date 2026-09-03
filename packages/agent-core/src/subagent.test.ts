import { describe, expect, it } from 'vitest';
import { Emitter, type SubAgentState, type SubAgentHandoff, type SubAgentSwarmSummary } from '@cluster/shared';
import { TaskPlanner } from '@cluster/task-engine';
import { Coordinator } from './coordinator.js';
import { DEFAULT_CONFIG } from './config.js';
import type { AgentEvents } from './events.js';

describe('Sub-Agent Swarm System', () => {
  it('TaskPlanner assigns specialized subagent roles for full-stack build goals', () => {
    const planner = new TaskPlanner();
    const graph = planner.planHeuristic({
      goal: 'Build a full stack dashboard with React UI components, backend api routes, and sqlite storage',
    });

    const tasks = Object.values(graph.tasks);
    expect(tasks.length).toBeGreaterThanOrEqual(4);

    const roles = tasks.map((t) => t.agentRole);
    expect(roles).toContain('researcher');
    expect(roles).toContain('planner');
    expect(roles).toContain('ui-builder');
    expect(roles).toContain('backend-builder');
    expect(roles).toContain('reviewer');
    expect(roles).toContain('tester');

    // UI and Backend builders should share the same dependency (planning) so they execute in parallel
    const uiTask = tasks.find((t) => t.agentRole === 'ui-builder');
    const backendTask = tasks.find((t) => t.agentRole === 'backend-builder');
    expect(uiTask).toBeDefined();
    expect(backendTask).toBeDefined();

    // Verify neither depends on the other
    expect(uiTask?.dependsOn).not.toContain(backendTask?.id);
    expect(backendTask?.dependsOn).not.toContain(uiTask?.id);
  });

  it('Coordinator lifecycle spawns subagents, records handoffs, and synthesizes swarm summary', async () => {
    const spawned: SubAgentState[] = [];
    const updates: SubAgentState[] = [];
    const handoffs: SubAgentHandoff[] = [];
    let summary: SubAgentSwarmSummary | null = null;

    const events = new Emitter<AgentEvents>();
    events.on('subagent:spawn', (data) => { spawned.push(data.subAgent); });
    events.on('subagent:update', (data) => { updates.push(data.subAgent); });
    events.on('subagent:handoff', (data) => { handoffs.push(data.handoff); });
    events.on('subagent:done', (data) => {
      summary = data.swarmSummary;
    });

    const mockProvider = {
      chat: async () => ({
        content: 'Task completed successfully',
        usage: { prompt: 10, completion: 20, total: 30 },
      }),
      streamChat: async () => {
        throw new Error('Not implemented');
      },
    };

    const mockRegistry = {
      execute: async () => ({
        success: true,
        result: { ok: true, output: 'Verified cleanly' },
        data: { ok: true },
      }),
      forRole: () => [],
      list: () => [],
      get: (name: string) => ({ name, execute: async () => ({ ok: true }) }),
      has: () => true,
      tools: new Map(),
    } as any;

    const coordinator = new Coordinator({
      config: { ...DEFAULT_CONFIG, apiKey: 'test_key' },
      provider: mockProvider as any,
      registry: mockRegistry,
      projectRoot: process.cwd(),
      sessionId: 'test_session_swarm_123',
      events,
      backupsDir: process.cwd(),
    });

    const graph = await coordinator.createPlan(
      'Create and implement a modern dashboard UI component with responsive styles and verification tests'
    );

    expect(spawned.length).toBeGreaterThanOrEqual(3);
    const spawnedRoles = spawned.map((s) => s.role);
    expect(spawnedRoles).toContain('researcher');
    expect(spawnedRoles).toContain('ui-builder');

    // Run graph execution
    const controller = new AbortController();
    const result = await coordinator.runGraph(graph, controller.signal);

    expect(result.graph).toBeDefined();
    expect(updates.length).toBeGreaterThan(0);
    expect(handoffs.length).toBeGreaterThan(0);

    // Verify handoff actions
    const handoffActions = handoffs.map((h) => h.action);
    expect(handoffActions).toContain('delegated');
    expect(handoffActions).toContain('started');
    expect(handoffActions).toContain('reported');
    expect(handoffActions).toContain('merged');

    // Verify final swarm summary
    expect(summary).not.toBeNull();
    const s = summary as unknown as SubAgentSwarmSummary;
    expect(s.subAgentsCount).toBe(spawned.length);
    expect(s.verification.passed).toBe(true);
    expect(s.decisions.length).toBeGreaterThan(0);
  });
});
