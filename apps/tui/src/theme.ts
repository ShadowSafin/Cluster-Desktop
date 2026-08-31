/**
 * Visual theme.
 *
 * Ink renders through <Text>, so the theme is a flat map of colour strings
 * rather than a styled-components sheet. Keeping it in one place makes the
 * whole UI re-skinnable without touching components.
 */

export const theme = {
  // Surfaces
  bg: undefined,

  // Text
  primary: 'white',
  secondary: 'gray',
  dim: 'gray',
  inverse: 'black',

  // Roles
  user: 'cyan',
  assistant: 'white',
  tool: 'magenta',
  system: 'blue',

  // Status
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
  accent: 'cyanBright',

  // Diff
  diffAdd: 'green',
  diffRemove: 'red',
  diffHeader: 'cyan',
  diffHunk: 'blue',

  // Chrome
  border: 'gray',
  highlight: 'cyan',
  muted: 'gray',
} as const;

export const phaseColors: Record<string, string> = {
  idle: theme.dim,
  planning: theme.info,
  thinking: theme.accent,
  reading: theme.tool,
  editing: theme.warning,
  running: theme.warning,
  verifying: theme.warning,
  summarizing: theme.accent,
  waiting: theme.warning,
  done: theme.success,
  error: theme.error,
  cancelled: theme.warning,
  failed: theme.error,
};

export const phaseLabels: Record<string, string> = {
  idle: 'ready',
  planning: 'planning',
  thinking: 'thinking',
  reading: 'reading',
  editing: 'editing',
  running: 'running',
  verifying: 'verifying',
  summarizing: 'summarizing',
  waiting: 'waiting',
  done: 'done',
  error: 'error',
  cancelled: 'cancelled',
  failed: 'failed',
};

export const statusIcons: Record<string, string> = {
  pending: '◦',
  running: '◐',
  success: '✔',
  error: '✖',
  cancelled: '⊘',
  rejected: '⊘',
};

export const riskColors: Record<string, string> = {
  safe: theme.success,
  caution: theme.warning,
  destructive: theme.error,
};
