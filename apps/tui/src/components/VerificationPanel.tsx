import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export interface VerificationResultView {
  kind: string;
  command: string;
  passed: boolean;
  durationMs: number;
  summary: string;
  failures?: Array<{ message: string; file?: string }>;
}

export interface VerificationPanelProps {
  results: VerificationResultView[];
  autoFixAttempts?: number;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({ results, autoFixAttempts }) => {
  if (results.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
        <Text color={theme.dim} bold>verification</Text>
        <Text color={theme.dim}>No checks run yet. Edits will trigger relevant tests.</Text>
        <Box marginTop={1}>
          <Text color={theme.dim}>relevant selection · lint · build · auto-fix loop</Text>
        </Box>
      </Box>
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1} paddingY={1}>
      <Box justifyContent="space-between">
        <Text color={theme.accent} bold>verification</Text>
        <Text color={failed ? theme.error : theme.success}>{passed} passed {failed ? `· ${failed} failed` : ''}</Text>
      </Box>

      {results.slice(0, 4).map((r, idx) => (
        <Box key={idx} flexDirection="column" marginTop={1} paddingLeft={1} borderStyle="single" borderColor={r.passed ? theme.success : theme.error}>
          <Box>
            <Text color={r.passed ? theme.success : theme.error}>{r.passed ? '✓' : '✗'} </Text>
            <Text color={theme.primary}>{r.kind}</Text>
            <Text color={theme.dim}> · {r.command.slice(0, 40)}</Text>
            <Text color={theme.dim}> · {r.durationMs}ms</Text>
          </Box>
          <Text color={theme.dim} wrap="wrap">{r.summary.slice(0, 160)}</Text>
          {r.failures && r.failures.length > 0 ? (
            <Box flexDirection="column" paddingLeft={2}>
              {r.failures.slice(0, 3).map((f, i) => (
                <Text key={i} color={theme.error}>· {f.file ? `${f.file}: ` : ''}{f.message.slice(0, 80)}</Text>
              ))}
              {r.failures.length > 3 ? <Text color={theme.dim}>… {r.failures.length - 3} more</Text> : null}
            </Box>
          ) : null}
        </Box>
      ))}

      {autoFixAttempts ? <Text color={theme.warning}>auto-fix attempts: {autoFixAttempts}</Text> : null}

      <Box marginTop={1}>
        <Text color={theme.dim}>Relevant test selection · auto-fix loop · plain-language summary</Text>
      </Box>
    </Box>
  );
};
