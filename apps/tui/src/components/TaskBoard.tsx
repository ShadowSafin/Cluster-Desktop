import React from 'react';
import { Box, Text } from 'ink';
import { theme, phaseColors } from '../theme.js';
import type { Task, TaskGraph } from '@cluster/shared';

export interface TaskBoardProps {
  graph: TaskGraph | null;
  width?: number;
  focused?: boolean;
}

function iconForStatus(status: Task['status']): { icon: string; color: string } {
  switch (status) {
    case 'done': return { icon: '✓', color: theme.success };
    case 'running': return { icon: '◐', color: theme.warning };
    case 'failed': return { icon: '✗', color: theme.error };
    case 'blocked': return { icon: '⊘', color: theme.warning };
    case 'ready': return { icon: '●', color: theme.accent };
    case 'pending': return { icon: '○', color: theme.dim };
    case 'cancelled': return { icon: '⨯', color: theme.dim };
    case 'paused': return { icon: '⏸', color: theme.warning };
    case 'skipped': return { icon: '−', color: theme.dim };
    default: return { icon: '○', color: theme.dim };
  }
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ graph }) => {
  if (!graph) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
        <Text color={theme.dim} bold>task board</Text>
        <Text color={theme.dim}>No tasks yet. Send a request to create a plan.</Text>
      </Box>
    );
  }

  const tasks = Object.values(graph.tasks);
  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    running: tasks.filter((t) => t.status === 'running').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  };

  // Group by agent role
  const byAgent = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.agentRole ?? 'unassigned';
    const arr = byAgent.get(key) ?? [];
    arr.push(t);
    byAgent.set(key, arr);
  }

  // Execution batches for timeline
  const batches = computeBatches(graph);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
      <Box justifyContent="space-between">
        <Text color={theme.accent} bold>task board</Text>
        <Text color={theme.dim}>{graph.status}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.dim}>{stats.done}/{stats.total} done</Text>
        <Text color={stats.running ? theme.warning : theme.dim}> · {stats.running} running</Text>
        <Text color={stats.failed ? theme.error : theme.dim}> · {stats.failed} failed</Text>
        <Text color={stats.blocked ? theme.warning : theme.dim}> · {stats.blocked} blocked</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.dim} bold>timeline</Text>
        {batches.map((batch, idx) => (
          <Box key={idx}>
            <Text color={theme.dim}>batch {idx + 1}: </Text>
            {batch.map((t) => {
              const { icon, color } = iconForStatus(t.status);
              return <Text key={t.id} color={color}>{icon} {t.title.slice(0, 18)}  </Text>;
            })}
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.dim} bold>tasks</Text>
        {tasks.slice(0, 12).map((task) => {
          const { icon, color } = iconForStatus(task.status);
          const retry = task.retry.attempts > 0 ? ` retry ${task.retry.attempts}/${task.retry.maxAttempts}` : '';
          return (
            <Box key={task.id} paddingLeft={1}>
              <Text color={color}>{icon} </Text>
              <Text color={task.status === 'running' ? theme.primary : theme.dim} wrap="truncate">
                {task.title} [{task.agentRole ?? '—'}]{retry}
              </Text>
            </Box>
          );
        })}
        {tasks.length > 12 ? <Text color={theme.dim}>… {tasks.length - 12} more</Text> : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.dim} bold>by agent</Text>
        {[...byAgent.entries()].map(([agent, list]) => (
          <Box key={agent}>
            <Text color={theme.secondary}>{agent}: </Text>
            <Text color={theme.dim}>{list.length} tasks ({list.filter((t) => t.status === 'done').length} done)</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

function computeBatches(graph: TaskGraph): Task[][] {
  // Simple dependency-based batching
  const tasks = Object.values(graph.tasks);
  if (tasks.length === 0) return [];
  // Use topological levels: those with no deps = batch 0, etc.
  const levelMap = new Map<string, number>();
  const visiting = new Set<string>();
  function level(id: string): number {
    if (levelMap.has(id)) return levelMap.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const task = graph.tasks[id];
    const lvl = task && task.dependsOn.length > 0 ? Math.max(...task.dependsOn.map((d) => level(d))) + 1 : 0;
    levelMap.set(id, lvl);
    visiting.delete(id);
    return lvl;
  }
  for (const t of tasks) level(t.id);
  const batches = new Map<number, Task[]>();
  for (const t of tasks) {
    const l = levelMap.get(t.id) ?? 0;
    const arr = batches.get(l) ?? [];
    arr.push(t);
    batches.set(l, arr);
  }
  return [...batches.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}
