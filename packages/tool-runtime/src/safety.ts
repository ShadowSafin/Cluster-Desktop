import type { RiskLevel } from '@cluster/shared';

/**
 * Command risk classification.
 *
 * This is a guardrail, not a sandbox: the goal is that genuinely destructive
 * commands always interrupt the user for confirmation, while ordinary build
 * and test commands never nag.
 */

export interface CommandRisk {
  risk: RiskLevel;
  /** Why the command was flagged; shown in the confirmation dialog. */
  reason?: string;
}

interface Rule {
  pattern: RegExp;
  risk: Exclude<RiskLevel, 'safe'>;
  reason: string;
}

const RULES: Rule[] = [
  { pattern: /\brm\s+(-[a-zA-Z]*\s+)*(-r|--recursive|-rf|-fr)\b/i, risk: 'destructive', reason: 'Recursive delete' },
  { pattern: /\brmdir\b/i, risk: 'destructive', reason: 'Directory removal' },
  { pattern: /\bdel\s+\/(f|s|q)\b/i, risk: 'destructive', reason: 'Forced delete' },
  { pattern: /\brm\s+-f\b/i, risk: 'destructive', reason: 'Forced file removal' },
  { pattern: /\bmkfs\b|\bformat\s+[a-z]:/i, risk: 'destructive', reason: 'Filesystem format' },
  { pattern: /\bdd\s+if=/i, risk: 'destructive', reason: 'Raw disk write' },
  { pattern: /\bshutdown\b|\breboot\b|\bhalt\b/i, risk: 'destructive', reason: 'System power control' },
  { pattern: />\s*\/dev\/(sda|nvme|disk)/i, risk: 'destructive', reason: 'Direct write to a block device' },
  { pattern: /:\(\)\s*\{.*\|\s*:\s*&\s*\}/i, risk: 'destructive', reason: 'Fork bomb' },
  { pattern: /\bchmod\s+(-R\s+)?777\b/i, risk: 'destructive', reason: 'World-writable permissions' },
  { pattern: /\btruncate\b|\bshred\b/i, risk: 'destructive', reason: 'Irreversible data destruction' },
  { pattern: /\bxargs\s+rm\b/i, risk: 'destructive', reason: 'Bulk delete via xargs' },

  { pattern: /\bgit\s+push\b[^\n]*--force\b|\bgit\s+push\s+-f\b/i, risk: 'destructive', reason: 'Force push rewrites remote history' },
  { pattern: /\bgit\s+reset\s+--hard\b/i, risk: 'destructive', reason: 'Hard reset discards local changes' },
  { pattern: /\bgit\s+clean\s+-[a-z]*f/i, risk: 'destructive', reason: 'git clean deletes untracked files' },
  { pattern: /\bgit\s+checkout\s+--\s+\./i, risk: 'destructive', reason: 'Discards all working tree changes' },
  { pattern: /\bgit\s+branch\s+-D\b/i, risk: 'destructive', reason: 'Force-deletes a branch' },
  { pattern: /\bgit\s+commit\b/i, risk: 'caution', reason: 'Creates a commit' },
  { pattern: /\bgit\s+(push|merge|rebase|cherry-pick|revert|stash)\b/i, risk: 'caution', reason: 'Modifies repository history or remote state' },
  { pattern: /\bgit\s+restore\b|\bgit\s+checkout\s+--\b/i, risk: 'caution', reason: 'Restores files, discarding edits' },

  { pattern: /\bnpm\s+publish\b|\bgit\s+tag\b/i, risk: 'caution', reason: 'Publishes or tags a release' },
  { pattern: /\bnpm\s+(install|i)\b|\bpnpm\s+(add|install)\b|\byarn\s+add\b|\bbun\s+add\b/i, risk: 'caution', reason: 'Installs or modifies dependencies' },
  { pattern: /\bpip\s+install\b|\buv\s+pip\b|\bpoetry\s+add\b/i, risk: 'caution', reason: 'Installs Python packages' },
  { pattern: /\bcargo\s+(add|install)\b/i, risk: 'caution', reason: 'Installs Rust crates' },
  { pattern: /\bsudo\b|\bdoas\b/i, risk: 'caution', reason: 'Elevated privileges' },
  { pattern: /\bcurl\b[^\n]*\|\s*(sudo\s+)?(sh|bash|zsh)\b|\bwget\b[^\n]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i, risk: 'destructive', reason: 'Piping remote content into a shell' },
  { pattern: /\b(curl|wget)\b/i, risk: 'caution', reason: 'Network access' },
  { pattern: /\bdocker\s+(rm|rmi|system\s+prune|compose\s+down)\b/i, risk: 'destructive', reason: 'Removes containers, images or volumes' },
  { pattern: /\bkill\s+-9\b|\bkillall\b|\bpkill\b/i, risk: 'caution', reason: 'Terminates processes' },
  { pattern: /\b(mv|move)\b[^\n]*\s+\/dev\/null\b/i, risk: 'destructive', reason: 'Moves a file to /dev/null' },
];

/** Classify a shell command. */
export function classifyCommand(command: string): CommandRisk {
  const trimmed = command.trim();
  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) {
      return { risk: rule.risk, reason: rule.reason };
    }
  }
  return { risk: 'safe' };
}

/** Paths that must never be overwritten by the file tools. */
const PROTECTED_BASENAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.git',
  '.gitconfig',
  '.npmrc',
  '.ssh',
  'id_rsa',
  'id_ed25519',
]);

export interface PathRisk {
  risk: RiskLevel;
  reason?: string;
}

/**
 * Flag edits to sensitive locations. These are still allowed after explicit
 * confirmation — the point is that they are never silent.
 */
export function classifyPath(relativePath: string): PathRisk {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  const basename = segments[segments.length - 1] ?? '';

  if (segments.some((segment) => PROTECTED_BASENAMES.has(segment))) {
    return { risk: 'destructive', reason: 'Protected or secret-bearing path' };
  }
  if (/\.(pem|key|p12|pfx|keystore)$/i.test(basename)) {
    return { risk: 'destructive', reason: 'Private key material' };
  }
  // Lockfiles: explicit `.lock` / `.sum` extensions, plus common hyphenated forms
  // like `package-lock.json`. These should always prompt before being rewritten.
  if (
    /\.(lock|sum|sync)$/i.test(basename) ||
    /-(?:lock|sum)\.(?:json|yaml|yml)$/i.test(basename)
  ) {
    return { risk: 'caution', reason: 'Lockfile' };
  }
  return { risk: 'safe' };
}
