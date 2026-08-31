import React from 'react';
import { Box, Text } from 'ink';
import type { AgentConfig } from '@cluster/agent-core';
import type { WorkspaceInfo } from '@cluster/shared';
import { theme } from '../theme.js';

export interface SplashProps {
  workspace: WorkspaceInfo | null;
  config: AgentConfig;
  projectRoot: string;
  resumed: boolean;
}

const LOGO = [
  '   ██████╗██╗   ██╗███████╗████████╗███████╗██████╗    ',
  '  ██╔════╝██║   ██║██╔════╝╚══██╔══╝██╔════╝██╔══██╗   ',
  '  ██║     ██║   ██║███████╗   ██║   █████╗  ██████╔╝   ',
  '  ██║     ██║   ██║╚════██║   ██║   ██╔══╝  ██╔══██╗   ',
  '  ╚██████╗╚██████╔╝███████║   ██║   ███████╗██║  ██║   ',
  '   ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝   ',
];

const LOGO_COMPACT = [
  '  ┌─ Cluster CLI ──────────────────┐',
  '  │ Terminal-first coding agent    │',
  '  └────────────────────────────────┘',
];

export const Splash: React.FC<SplashProps> = ({ workspace, config, projectRoot, resumed }) => {
  const details: Array<[string, string]> = [
    ['project', workspace?.name ?? projectRoot],
    ['root', projectRoot],
    ['type', workspace ? `${workspace.project.kind}${workspace.project.packageManager ? ` · ${workspace.project.packageManager}` : ''}` : 'unknown'],
    ['model', config.model],
    ['endpoint', config.baseUrl],
    ['tools', config.toolMode === 'text' ? 'text protocol' : 'function calling'],
  ];

  if (workspace?.languages.length) details.push(['languages', workspace.languages.join(', ')]);
  if (workspace?.git) {
    details.push(['git', `${workspace.git.branch}${workspace.git.dirty ? ' (uncommitted changes)' : ' (clean)'}`]);
  }

  // Always use compact logo for Cluster CLI — fits in 44 columns (55% of 80 cols)
  // Full LOGO is 50 chars wide and would truncate on narrow terminals
  const logoLines = LOGO_COMPACT;

  return (
    <Box flexDirection="column" paddingX={1} overflow="hidden">
      <Box flexDirection="column" overflow="hidden">
        {logoLines.map((line) => (
          <Text key={line} color={theme.accent} wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.accent} bold wrap="wrap">
          Cluster CLI
        </Text>
        <Text color={theme.dim} wrap="wrap">
          {' — Terminal-first coding agent'}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.dim}>
          {resumed ? 'Resumed session. Pick up where you left off.' : 'A terminal-first coding agent.'}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {details.map(([label, value]) => (
          <Box key={label}>
            <Box width={12}>
              <Text color={theme.dim}>{label}</Text>
            </Box>
            <Text color={theme.primary} wrap="wrap">
              {value}
            </Text>
          </Box>
        ))}
      </Box>

      {!config.apiKey ? (
        <Box marginTop={1} borderStyle="round" borderColor={theme.error} paddingX={1} flexDirection="column">
          <Text color={theme.error} bold>
            No API key configured
          </Text>
          <Text color={theme.dim} wrap="wrap">
            Set CLUSTER_API_KEY (or OPENAI_API_KEY) in your environment or in a .env file, then restart.
            You can also run `cluster doctor` to check the setup.
          </Text>
        </Box>
      ) : null}
    </Box>
  );
};
