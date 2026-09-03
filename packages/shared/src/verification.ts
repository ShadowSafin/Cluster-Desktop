/**
 * Automatic verification loop types.
 */

export type VerificationKind = 'test' | 'build' | 'lint' | 'format' | 'typecheck' | 'custom';

export interface VerificationCommand {
  kind: VerificationKind;
  command: string;
  cwd?: string;
  /** Glob patterns that trigger this verification. */
  relevantGlobs?: string[];
}

export interface VerificationResult {
  id: string;
  sessionId: string;
  taskId?: string;
  kind: VerificationKind;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
  /** Parsed failures. */
  failures: Array<{ file?: string; line?: number; message: string }>;
  /** AI summary of what failed. */
  summary: string;
  attemptedFixes: number;
  autoFixed: boolean;
  createdAt: string;
}

export interface VerificationSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: VerificationResult[];
  /** Plain-language summary for the TUI. */
  message: string;
}

export interface VerificationConfig {
  autoRun: boolean;
  maxAutoFixAttempts: number;
  relevantSelection: boolean;
  timeoutMs: number;
}

/* -------------------------------------------------------------------------- */
/* Single-Agent Verification, Critique & Self-Repair System                    */
/* -------------------------------------------------------------------------- */

export type VerificationCheckCategory =
  | 'syntax_build'
  | 'imports_refs'
  | 'ui_ux'
  | 'wiring_ipc'
  | 'state_errors'
  | 'completeness';

export type VerificationCheckStatus = 'passed' | 'failed' | 'warning' | 'skipped';

export interface VerificationCheck {
  id: string;
  category: VerificationCheckCategory;
  title: string;
  status: VerificationCheckStatus;
  message: string;
  file?: string;
  line?: number;
  details?: string;
}

export type CritiqueAspect =
  | 'clutter'
  | 'completeness'
  | 'wiring'
  | 'layout_stability'
  | 'usability'
  | 'spec_compliance';

export interface CritiqueItem {
  id: string;
  aspect: CritiqueAspect;
  question: string;
  passed: boolean;
  critique: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface RepairAttempt {
  attempt: number;
  timestamp: string;
  issuesAddressed: string[];
  targetFiles: string[];
  actionsTaken: string[];
  success: boolean;
  notes?: string;
}

export type VerificationGateStatus =
  | 'verifying'
  | 'critiquing'
  | 'repairing'
  | 're-verifying'
  | 'passed'
  | 'failed'
  | 'needs-work';

export interface VerificationReport {
  id: string;
  sessionId: string;
  turnId: string;
  status: VerificationGateStatus;
  gateAccepted: boolean;
  targetFiles: string[];
  checks: VerificationCheck[];
  critiques: CritiqueItem[];
  repairs: RepairAttempt[];
  summary: string;
  createdAt: string;
  finishedAt?: string;
}
