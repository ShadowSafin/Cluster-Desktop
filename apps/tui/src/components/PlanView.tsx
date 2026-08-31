import React from 'react';
import { Box, Text } from 'ink';
import type { Plan } from '@cluster/shared';
import { theme } from '../theme.js';

export interface PlanViewProps {
  plan: Plan;
}

const ICONS: Record<string, string> = {
  pending: '◦',
  'in-progress': '◐',
  done: '✔',
  skipped: '–',
};

export const PlanView: React.FC<PlanViewProps> = ({ plan }) => (
  <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
    <Text color={theme.accent} bold>
      plan · {plan.goal}
    </Text>
    {plan.steps.map((step) => (
      <Box key={step.id}>
        <Box width={3}>
          <Text color={step.status === 'done' ? theme.success : theme.dim}>
            {ICONS[step.status] ?? '◦'}
          </Text>
        </Box>
        <Text color={step.status === 'done' ? theme.dim : theme.primary} wrap="wrap">
          {step.text}
        </Text>
      </Box>
    ))}
  </Box>
);
