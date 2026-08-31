import React from 'react';
import { Box, Text } from 'ink';

export type TaskStatusView = 'pending' | 'blocked' | 'ready' | 'running' | 'done' | 'failed' | 'skipped' | 'cancelled' | 'paused';

const STATUS_ICON: Record<TaskStatusView, string> = {
  pending: '○',
  blocked: '⊘',
  ready: '●',
  running: '◐',
  done: '✓',
  failed: '✗',
  skipped: '−',
  cancelled: '⨯',
  paused: '⏸',
};

const STATUS_COLOR: Record<TaskStatusView, string> = {
  pending: 'gray',
  blocked: 'yellow',
  ready: 'cyan',
  running: 'blue',
  done: 'green',
  failed: 'red',
  skipped: 'gray',
  cancelled: 'gray',
  paused: 'yellow',
};

export const TaskItem: React.FC<{
  title: string;
  status: TaskStatusView;
  agent?: string;
  duration?: string;
  error?: string;
  subtasks?: number;
}> = ({ title, status, agent, duration, error, subtasks }) => {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={STATUS_COLOR[status]}>{STATUS_ICON[status]} </Text>
        <Text bold={status === 'running'}>{title}</Text>
        {agent ? <Text color="gray"> [{agent}]</Text> : null}
        {duration ? <Text color="gray"> {duration}</Text> : null}
        {subtasks ? <Text color="gray"> ({subtasks} subtasks)</Text> : null}
      </Box>
      {error ? <Text color="red">  ↳ {error.slice(0, 80)}</Text> : null}
    </Box>
  );
};

export const AgentIndicator: React.FC<{ role: string; phase: string; message?: string }> = ({ role, phase, message }) => {
  const color = phase === 'acting' ? 'green' : phase === 'thinking' ? 'yellow' : phase === 'error' ? 'red' : 'cyan';
  return (
    <Box>
      <Text backgroundColor={color} color="white" bold> {role} </Text>
      <Text color={color}> {phase}</Text>
      {message ? <Text color="gray"> — {message.slice(0, 60)}</Text> : null}
    </Box>
  );
};
