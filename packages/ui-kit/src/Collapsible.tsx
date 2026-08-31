import React from 'react';
import { Box, Text } from 'ink';

export interface CollapsibleProps {
  title: string;
  collapsed?: boolean;
  onToggle?: () => void;
  badge?: string;
  children: React.ReactNode;
}

export const Collapsible: React.FC<CollapsibleProps> = ({ title, collapsed, onToggle, badge, children }) => {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box>
        <Text bold>{collapsed ? '▸' : '▾'} {title}</Text>
        {badge ? <Text color="gray"> ({badge})</Text> : null}
        {onToggle ? <Text dimColor> [enter]</Text> : null}
      </Box>
      {!collapsed ? <Box flexDirection="column" marginTop={1}>{children}</Box> : null}
    </Box>
  );
};

export const LogPanel: React.FC<{ lines: string[]; maxLines?: number; title?: string }> = ({ lines, maxLines = 12, title = 'Logs' }) => {
  const visible = lines.slice(-maxLines);
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{title}</Text>
      {visible.map((line, idx) => (
        <Text key={idx} wrap="wrap" color="gray">
          {line}
        </Text>
      ))}
      {lines.length > maxLines ? <Text dimColor>… {lines.length - maxLines} more lines</Text> : null}
    </Box>
  );
};
