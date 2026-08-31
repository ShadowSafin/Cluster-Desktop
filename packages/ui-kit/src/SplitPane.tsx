import React from 'react';
import { Box } from 'ink';

export interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: string | number;
  rightWidth?: string | number;
  direction?: 'horizontal' | 'vertical';
  borderColor?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({ left, right, leftWidth = '55%', rightWidth = '45%', direction = 'horizontal', borderColor = 'gray' }) => {
  if (direction === 'vertical') {
    return (
      <Box flexDirection="column" width="100%">
        <Box flexDirection="column" width="100%">
          {left}
        </Box>
        <Box borderStyle="single" borderColor={borderColor} width="100%" />
        <Box flexDirection="column" width="100%">
          {right}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" width="100%">
      <Box flexDirection="column" width={leftWidth} borderStyle="single" borderColor={borderColor} paddingX={1}>
        {left}
      </Box>
      <Box flexDirection="column" width={rightWidth} borderStyle="single" borderColor={borderColor} paddingX={1}>
        {right}
      </Box>
    </Box>
  );
};

export const Pane: React.FC<{ title?: string; children: React.ReactNode; focused?: boolean; width?: string | number; height?: number | string }> = ({ title, children, focused }) => {
  return (
    <Box flexDirection="column" borderStyle={focused ? 'double' : 'single'} borderColor={focused ? 'cyan' : 'gray'} paddingX={1} paddingY={0}>
      {title ? <Box marginBottom={1}>{children}</Box> : children}
    </Box>
  );
};
