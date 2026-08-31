import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export interface CollapsibleLogsProps {
  title: string;
  lines: string[];
  defaultCollapsed?: boolean;
  maxHeight?: number;
}

export const CollapsibleLogs: React.FC<CollapsibleLogsProps> = ({ title, lines, defaultCollapsed = true, maxHeight = 12 }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  if (lines.length === 0) return null;
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={0}>
      <Box>
        <Text color={theme.accent} bold>{collapsed ? '▸' : '▾'} {title}</Text>
        <Text color={theme.dim}> ({lines.length} lines) [enter to {collapsed ? 'expand' : 'collapse'}]</Text>
      </Box>
      {!collapsed ? (
        <Box flexDirection="column" marginTop={1} height={Math.min(lines.length, maxHeight)} overflow="hidden">
          {lines.slice(-maxHeight).map((line, idx) => (
            <Text key={idx} color={theme.dim} wrap="truncate">{line.slice(0, 100)}</Text>
          ))}
          {lines.length > maxHeight ? <Text color={theme.dim}>… {lines.length - maxHeight} earlier lines hidden …</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
};

export const LiveOutputPanel: React.FC<{ outputs: Record<string, string>; focusedCallId?: string }> = ({ outputs, focusedCallId }) => {
  const entries = Object.entries(outputs);
  if (entries.length === 0) return null;
  const active = focusedCallId && outputs[focusedCallId] ? [[focusedCallId, outputs[focusedCallId]]] as Array<[string, string]> : entries.slice(-1);
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.warning} paddingX={1}>
      <Text color={theme.warning} bold>live output</Text>
      {active.map(([callId, text]) => (
        <Box key={callId} flexDirection="column">
          <Text color={theme.dim}>{callId.slice(0, 12)}…</Text>
          {text.split('\n').slice(-8).map((line, idx) => (
            <Text key={idx} color={theme.primary} wrap="truncate">{line.slice(0, 80)}</Text>
          ))}
        </Box>
      ))}
    </Box>
  );
};
