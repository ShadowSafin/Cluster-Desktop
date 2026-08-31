import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { MemoryEntry } from '@cluster/shared';

export interface MemoryPanelProps {
  projectEntries: MemoryEntry[];
  sessionEntries: MemoryEntry[];
  importantFiles?: Array<{ path: string; reason: string }>;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ projectEntries, sessionEntries, importantFiles }) => {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
      <Text color={theme.accent} bold>memory · project knowledge</Text>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.dim} bold>project ({projectEntries.length})</Text>
        {projectEntries.slice(0, 4).map((e) => (
          <Box key={e.id}>
            <Text color={theme.secondary}>[{e.category}] </Text>
            <Text color={theme.dim} wrap="truncate">{e.key}: {e.value.slice(0, 60)}</Text>
          </Box>
        ))}
        {projectEntries.length === 0 ? <Text color={theme.dim}>no project memory yet — will accumulate as you work</Text> : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.dim} bold>session ({sessionEntries.length})</Text>
        {sessionEntries.slice(0, 3).map((e) => (
          <Box key={e.id}>
            <Text color={theme.secondary}>[{e.category}] </Text>
            <Text color={theme.dim} wrap="truncate">{e.key}: {e.value.slice(0, 60)}</Text>
          </Box>
        ))}
      </Box>

      {importantFiles && importantFiles.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.dim} bold>important files</Text>
          {importantFiles.slice(0, 5).map((f) => (
            <Text key={f.path} color={theme.primary}>· {f.path} <Text color={theme.dim}>— {f.reason.slice(0, 40)}</Text></Text>
          ))}
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text color={theme.dim}>inspectable & editable · persists across sessions · bounded</Text>
      </Box>
    </Box>
  );
};
