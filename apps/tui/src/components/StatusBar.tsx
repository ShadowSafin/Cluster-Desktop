import React from 'react';
import { Box, Text } from 'ink';
import type { AgentState, TokenUsage, WorkspaceInfo } from '@cluster/shared';
import { formatGitState } from '@cluster/workspace';
import { phaseColors, theme } from '../theme.js';
import { useSpinner } from '../hooks/useSpinner.js';

export interface StatusBarProps {
  state: AgentState;
  workspace: WorkspaceInfo | null;
  width: number;
  busy: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ state, workspace, width, busy }) => {
  const spinner = useSpinner(busy);
  const color = phaseColors[state.phase] ?? theme.dim;

  const usage = formatUsage(state.usage);
  const iteration = state.maxIterations > 0 ? `${state.iteration}/${state.maxIterations}` : '—';
  const git = workspace ? formatGitState(workspace.git) : 'no git';
  const project = workspace?.name ?? 'workspace';

  const left = `${spinner} ${state.label}`;
  const right = `${project} · ${git} · ${state.model} · iter ${iteration} · ${usage}`;

  return (
    <Box width={width} justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color={color} bold>
          {left}
        </Text>
      </Box>
      <Box>
        <Text color={theme.dim} wrap="truncate">
          {right}
        </Text>
      </Box>
    </Box>
  );
};

function formatUsage(usage: TokenUsage): string {
  if (usage.total === 0) return '0 tok';
  if (usage.total < 1000) return `${usage.total} tok`;
  return `${(usage.total / 1000).toFixed(1)}k tok`;
}
