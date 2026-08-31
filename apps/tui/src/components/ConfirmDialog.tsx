import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { ConfirmationRequest } from '@cluster/tool-runtime';
import { riskColors, theme } from '../theme.js';
import { DiffView } from './DiffView.js';

export interface ConfirmDialogProps {
  request: ConfirmationRequest;
  onResolve(approved: boolean): void;
}

/**
 * Safety gate for destructive tools.
 *
 * Rendering is modal by construction: while this is mounted the composer and
 * global shortcuts are inactive, so the only ways out are y, n or Esc.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ request, onResolve }) => {
  useInput((input, key) => {
    if (key.escape) {
      onResolve(false);
      return;
    }
    if (key.return) {
      onResolve(true);
      return;
    }
    const normalized = input.toLowerCase();
    if (normalized === 'y') onResolve(true);
    if (normalized === 'n') onResolve(false);
  });

  const color = riskColors[request.risk] ?? theme.warning;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={2} paddingY={1}>
      <Box>
        <Text color={color} bold>
          {request.risk === 'destructive' ? '⚠  ' : '?  '}
          {request.title}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text wrap="wrap">{request.summary}</Text>
      </Box>

      {request.detail ? (
        <Box marginTop={1} flexDirection="column">
          {looksLikeDiff(request.detail) ? (
            <DiffView diff={request.detail} maxLines={18} />
          ) : (
            <Text color={theme.primary} wrap="wrap">
              {request.detail}
            </Text>
          )}
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text color={theme.dim}>Enter / y to allow · n / Esc to decline</Text>
      </Box>
    </Box>
  );
};

function looksLikeDiff(value: string): boolean {
  return /(^|\n)@@ /.test(value) || /^--- /.test(value.trimStart());
}
