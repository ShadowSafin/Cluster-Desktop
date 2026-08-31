import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { AgentRole } from '@cluster/shared';

export interface AgentActivityItem {
  agentRole: AgentRole;
  phase: string;
  message: string;
  timestamp: string;
}

export interface AgentPanelProps {
  activities: AgentActivityItem[];
  tasks?: Array<{ role: AgentRole; status: string; title: string }>;
}

const ROLE_COLOR: Record<string, string> = {
  planner: 'cyan',
  coder: 'green',
  reviewer: 'magenta',
  tester: 'yellow',
  context: 'blue',
  coordinator: 'white',
};

export const AgentPanel: React.FC<AgentPanelProps> = ({ activities, tasks }) => {
  const recent = activities.slice(-8);
  const byRole = new Map<string, number>();
  for (const a of activities) byRole.set(a.agentRole, (byRole.get(a.agentRole) ?? 0) + 1);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
      <Box justifyContent="space-between">
        <Text color={theme.accent} bold>agents</Text>
        <Text color={theme.dim}>{activities.length} events</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {recent.length === 0 ? <Text color={theme.dim}>idle — no agent activity</Text> : recent.map((act, idx) => (
          <Box key={idx}>
            <Text backgroundColor={ROLE_COLOR[act.agentRole] ?? 'gray'} color="black"> {act.agentRole} </Text>
            <Text color={phaseColor(act.phase)}> {act.phase}</Text>
            <Text color={theme.dim} wrap="truncate"> — {act.message.slice(0, 60)}</Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.dim} bold>activity by agent</Text>
        {[...byRole.entries()].map(([role, count]) => (
          <Box key={role}>
            <Text color={ROLE_COLOR[role] ?? theme.dim}>{role}: </Text>
            <Text color={theme.dim}>{count} actions</Text>
            {tasks?.filter((t) => t.role === role).length ? <Text color={theme.dim}> · {tasks.filter((t) => t.role === role).length} tasks</Text> : null}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.dim}>parallel: </Text>
        <Text color={theme.success}>coder ×3 · tester ×2 · context ×2</Text>
      </Box>
    </Box>
  );
};

function phaseColor(phase: string): string {
  switch (phase) {
    case 'acting':
    case 'running': return 'green';
    case 'thinking':
    case 'planning': return 'yellow';
    case 'error': return 'red';
    case 'waiting': return 'blue';
    case 'done': return 'green';
    default: return 'cyan';
  }
}
