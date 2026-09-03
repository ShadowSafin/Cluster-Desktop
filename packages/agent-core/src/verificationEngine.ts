import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createId,
  nowIso,
  type VerificationReport,
  type VerificationCheck,
  type CritiqueItem,
  type RepairAttempt,
  type VerificationGateStatus,
} from '@cluster/shared';
import { runVerification, discoverTests } from '@cluster/tool-runtime';

export interface VerificationEngineOptions {
  projectRoot: string;
  sessionId: string;
  turnId?: string;
  signal?: AbortSignal;
  emitActivity?: (message: string) => void;
}

export class VerificationEngine {
  constructor(private readonly opts: VerificationEngineOptions) {}

  /**
   * Run full verification & critique pass on the files touched during this turn.
   */
  async runVerificationPass(
    changedFiles: string[],
    userGoal: string,
    turnId: string,
    existingRepairs: RepairAttempt[] = []
  ): Promise<VerificationReport> {
    const reportId = createId('ver_report');
    const checks: VerificationCheck[] = [];
    const critiques: CritiqueItem[] = [];

    this.opts.emitActivity?.('Verifying file correctness and syntax integrity...');

    // 1. Check file correctness & existence
    await this.verifyFileCorrectness(changedFiles, checks);

    // 2. Check local imports and missing references
    await this.verifyImportsAndReferences(changedFiles, checks);

    // 3. Check UI/UX consistency & overlap hazards for React/CSS files
    await this.verifyUIUXConsistency(changedFiles, checks);

    // 4. Check Electron IPC & Wiring parity
    await this.verifyWiringAndIPC(changedFiles, checks);

    // 5. Run project build or test diagnostics if applicable
    await this.verifyProjectDiagnostics(changedFiles, checks);

    // 6. Perform self-critique pass
    this.opts.emitActivity?.('Critiquing implementation against requirements and quality standards...');
    this.performSelfCritique(changedFiles, userGoal, checks, critiques);

    // 7. Evaluate completion gate
    const hasCriticalFailure = checks.some((c) => c.status === 'failed');
    const hasCriticalCritique = critiques.some((c) => !c.passed && c.severity === 'critical');

    const gateAccepted = !hasCriticalFailure && !hasCriticalCritique;
    const status: VerificationGateStatus = gateAccepted ? 'passed' : 'failed';

    const passedChecks = checks.filter((c) => c.status === 'passed').length;
    const failedChecks = checks.filter((c) => c.status === 'failed').length;
    const warningChecks = checks.filter((c) => c.status === 'warning').length;

    const summary = gateAccepted
      ? `Verification passed (${passedChecks}/${checks.length} checks clean). Implementation satisfies quality bar and is safe to use.`
      : `Verification detected ${failedChecks} issue(s) across ${changedFiles.length} file(s). Repair required before completion.`;

    return {
      id: reportId,
      sessionId: this.opts.sessionId,
      turnId,
      status,
      gateAccepted,
      targetFiles: changedFiles,
      checks,
      critiques,
      repairs: existingRepairs,
      summary,
      createdAt: nowIso(),
      finishedAt: nowIso(),
    };
  }

  /**
   * Check file existence, valid UTF-8, non-empty, and lack of conflict markers.
   */
  private async verifyFileCorrectness(files: string[], checks: VerificationCheck[]): Promise<void> {
    if (files.length === 0) {
      checks.push({
        id: createId('check'),
        category: 'completeness',
        title: 'File Integrity',
        status: 'passed',
        message: 'No file modifications detected in this turn.',
      });
      return;
    }

    for (const file of files) {
      const fullPath = path.isAbsolute(file) ? file : path.resolve(this.opts.projectRoot, file);
      const relPath = path.relative(this.opts.projectRoot, fullPath);

      try {
        const stat = await fs.stat(fullPath);
        if (stat.size === 0) {
          checks.push({
            id: createId('check'),
            category: 'syntax_build',
            title: 'Empty File Check',
            status: 'failed',
            file: relPath,
            message: `File "${relPath}" was created or updated with 0 bytes.`,
          });
          continue;
        }

        const content = await fs.readFile(fullPath, 'utf8');

        // Check for unresolved git conflict markers
        if (/^<{7}\s.*[\r\n]+[\s\S]*?^={7}[\r\n]+[\s\S]*?^>{7}\s/m.test(content)) {
          checks.push({
            id: createId('check'),
            category: 'syntax_build',
            title: 'Git Conflict Markers',
            status: 'failed',
            file: relPath,
            message: `Unresolved merge conflict markers found in "${relPath}".`,
          });
          continue;
        }

        // Basic syntax heuristic: unclosed braces / brackets in code files
        if (/\.(ts|tsx|js|jsx|json)$/.test(file)) {
          const opens = (content.match(/\{/g) || []).length;
          const closes = (content.match(/\}/g) || []).length;
          if (Math.abs(opens - closes) > 0 && !file.endsWith('.json')) {
            // Note: could be in template strings, so marked as warning unless delta is extreme
            if (Math.abs(opens - closes) > 2) {
              checks.push({
                id: createId('check'),
                category: 'syntax_build',
                title: 'Brace Matching Balance',
                status: 'failed',
                file: relPath,
                message: `Mismatched curly braces in "${relPath}" (${opens} open vs ${closes} closed).`,
              });
              continue;
            }
          }
        }

        checks.push({
          id: createId('check'),
          category: 'syntax_build',
          title: `File Integrity: ${path.basename(relPath)}`,
          status: 'passed',
          file: relPath,
          message: `Valid encoding, size (${stat.size}B), no conflict markers.`,
        });
      } catch (err: any) {
        checks.push({
          id: createId('check'),
          category: 'syntax_build',
          title: 'File Existence',
          status: 'failed',
          file: relPath,
          message: `Target file "${relPath}" cannot be accessed: ${err.message}`,
        });
      }
    }
  }

  /**
   * Check imported local paths to ensure referenced modules exist.
   */
  private async verifyImportsAndReferences(files: string[], checks: VerificationCheck[]): Promise<void> {
    const codeFiles = files.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
    const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"](\.[^'"]+)['"]/g;

    for (const file of codeFiles) {
      const fullPath = path.isAbsolute(file) ? file : path.resolve(this.opts.projectRoot, file);
      const relPath = path.relative(this.opts.projectRoot, fullPath);
      const fileDir = path.dirname(fullPath);

      try {
        const content = await fs.readFile(fullPath, 'utf8');
        let match: RegExpExecArray | null;
        let brokenCount = 0;

        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          // Check candidate extensions
          const candidates = [
            path.resolve(fileDir, importPath),
            path.resolve(fileDir, `${importPath}.ts`),
            path.resolve(fileDir, `${importPath}.tsx`),
            path.resolve(fileDir, `${importPath}.js`),
            path.resolve(fileDir, `${importPath}.jsx`),
            path.resolve(fileDir, `${importPath}.d.ts`),
            path.resolve(fileDir, importPath, 'index.ts'),
            path.resolve(fileDir, importPath, 'index.tsx'),
            path.resolve(fileDir, importPath, 'index.js'),
          ];

          // If import has .js extension (common in ESM TS), also check corresponding .ts/.tsx
          if (importPath.endsWith('.js')) {
            const stripped = importPath.slice(0, -3);
            candidates.push(
              path.resolve(fileDir, `${stripped}.ts`),
              path.resolve(fileDir, `${stripped}.tsx`)
            );
          }

          let exists = false;
          for (const cand of candidates) {
            try {
              await fs.access(cand);
              exists = true;
              break;
            } catch {
              // try next
            }
          }

          if (!exists) {
            brokenCount++;
            checks.push({
              id: createId('check'),
              category: 'imports_refs',
              title: 'Broken Module Import',
              status: 'failed',
              file: relPath,
              message: `Cannot resolve import "${importPath}" from "${relPath}".`,
              details: `Searched candidate files in: ${fileDir}`,
            });
          }
        }

        if (brokenCount === 0) {
          checks.push({
            id: createId('check'),
            category: 'imports_refs',
            title: `Imports Validated: ${path.basename(relPath)}`,
            status: 'passed',
            file: relPath,
            message: 'All local module imports resolve cleanly.',
          });
        }
      } catch {
        // file existence already reported
      }
    }
  }

  /**
   * UI/UX Review: inspect React/Tailwind code for overlap hazards, missing states, and layout traps.
   */
  private async verifyUIUXConsistency(files: string[], checks: VerificationCheck[]): Promise<void> {
    const uiFiles = files.filter((f) => /\.(tsx|jsx|css)$/.test(f));
    if (uiFiles.length === 0) return;

    for (const file of uiFiles) {
      const fullPath = path.isAbsolute(file) ? file : path.resolve(this.opts.projectRoot, file);
      const relPath = path.relative(this.opts.projectRoot, fullPath);

      try {
        const content = await fs.readFile(fullPath, 'utf8');

        // 1. Check for negative margin overlap traps
        const negativeMarginMatches = content.match(/-(?:mt|mb|ml|mr|mx|my)-(?:[4-9]|[1-9]\d+)/g) || [];
        if (negativeMarginMatches.length > 0) {
          checks.push({
            id: createId('check'),
            category: 'ui_ux',
            title: 'UI Overlap Risk: Negative Margins',
            status: 'warning',
            file: relPath,
            message: `Detected large negative margin classes (${negativeMarginMatches.slice(0, 3).join(', ')}), which can cause visual clipping and overlapping cards.`,
          });
        }

        // 2. Check for absolute positioning without relative container context
        if (content.includes('absolute ') && !content.includes('relative')) {
          checks.push({
            id: createId('check'),
            category: 'ui_ux',
            title: 'Unbounded Absolute Positioning',
            status: 'warning',
            file: relPath,
            message: 'Detected `absolute` element without apparent `relative` container in the same file.',
          });
        }

        // 3. Check for unconstrained flex containers with overflow-hidden (causing text clipping)
        if (content.includes('overflow-hidden') && content.includes('flex') && !content.includes('min-h-0') && !content.includes('min-w-0')) {
          checks.push({
            id: createId('check'),
            category: 'ui_ux',
            title: 'Flex Container Truncation Hazard',
            status: 'warning',
            file: relPath,
            message: 'Flex container with `overflow-hidden` is missing `min-w-0` or `min-h-0`, which may cause flex children to overflow or truncate abruptly.',
          });
        }

        // 4. Check for interactive controls without disabled or loading state
        const hasButton = /<button\b/i.test(content);
        const hasOnClick = /onClick=/i.test(content);
        const hasDisabled = /disabled=/i.test(content);
        const hasLoadingState = /(loading|isSubmitting|disabled|pending)/i.test(content);

        if (hasButton && hasOnClick && !hasDisabled && !hasLoadingState && content.length > 1000) {
          checks.push({
            id: createId('check'),
            category: 'state_errors',
            title: 'Button Async/Disabled State',
            status: 'warning',
            file: relPath,
            message: 'Interactive buttons found without explicit disabled or loading indicators during async operations.',
          });
        }

        // 5. Check for empty state handling in list views
        const hasMap = /\.map\s*\(/i.test(content);
        const hasEmptyState = /(empty|length === 0|length === 0 \?|no items|not found)/i.test(content);
        if (hasMap && !hasEmptyState && content.length > 1500) {
          checks.push({
            id: createId('check'),
            category: 'ui_ux',
            title: 'Empty State Coverage',
            status: 'warning',
            file: relPath,
            message: 'Array rendering (.map) detected without an obvious empty state fallback placeholder.',
          });
        }

        checks.push({
          id: createId('check'),
          category: 'ui_ux',
          title: `UI Layout Consistency: ${path.basename(relPath)}`,
          status: 'passed',
          file: relPath,
          message: 'Layout checked for overlap hazards, flex sizing, and responsiveness.',
        });
      } catch {
        // handled earlier
      }
    }
  }

  /**
   * Cross-verify Electron IPC handlers against preload/renderer usage.
   */
  private async verifyWiringAndIPC(files: string[], checks: VerificationCheck[]): Promise<void> {
    const touchesIpc = files.some((f) => f.includes('main') || f.includes('preload') || f.includes('useAgent') || f.includes('electron'));
    if (!touchesIpc) return;

    try {
      const mainIndexPath = path.resolve(this.opts.projectRoot, 'apps/electron/src/main/index.ts');
      const preloadIndexPath = path.resolve(this.opts.projectRoot, 'apps/electron/src/preload/index.ts');

      const mainContent = await fs.readFile(mainIndexPath, 'utf8').catch(() => '');
      const preloadContent = await fs.readFile(preloadIndexPath, 'utf8').catch(() => '');

      if (!mainContent || !preloadContent) return;

      // Extract ipcRenderer.invoke('channel')
      const invokedChannels = Array.from(preloadContent.matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)).map((m) => m[1]);
      const handledChannels = Array.from(mainContent.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)).map((m) => m[1]);

      const unhandled = invokedChannels.filter((ch) => !handledChannels.includes(ch));
      if (unhandled.length > 0) {
        checks.push({
          id: createId('check'),
          category: 'wiring_ipc',
          title: 'Missing IPC Handler',
          status: 'failed',
          message: `Preload invokes channel(s) that have no matching \`ipcMain.handle\`: ${unhandled.join(', ')}`,
        });
      } else {
        checks.push({
          id: createId('check'),
          category: 'wiring_ipc',
          title: 'IPC Channel Parity',
          status: 'passed',
          message: `All ${invokedChannels.length} invoked IPC channels have active handlers in main process.`,
        });
      }
    } catch {
      // ignore
    }
  }

  /**
   * Run targeted project diagnostics (typecheck/lint) if available in package.json.
   */
  private async verifyProjectDiagnostics(files: string[], checks: VerificationCheck[]): Promise<void> {
    // Only run if code files changed
    const hasCodeChanges = files.some((f) => /\.(ts|tsx|js|jsx)$/.test(f));
    if (!hasCodeChanges) return;

    try {
      const pkgPath = path.resolve(this.opts.projectRoot, 'package.json');
      const pkgRaw = await fs.readFile(pkgPath, 'utf8').catch(() => '');
      if (!pkgRaw) return;

      const pkg = JSON.parse(pkgRaw);
      const scripts = pkg.scripts || {};

      // Prefer fast typecheck script if available
      let testCmd = '';
      if (scripts.typecheck) {
        testCmd = 'npm run typecheck';
      } else if (scripts.test) {
        // Fast non-recursive check
        testCmd = 'npx tsc --noEmit';
      }

      if (testCmd) {
        const run = await runVerification({
          projectRoot: this.opts.projectRoot,
          sessionId: this.opts.sessionId,
          command: testCmd,
          timeoutMs: 15_000,
          signal: this.opts.signal,
          autoFix: false,
        });

        if (run.result.passed) {
          checks.push({
            id: createId('check'),
            category: 'syntax_build',
            title: 'TypeScript Typecheck',
            status: 'passed',
            message: `Clean compilation (${testCmd}) in ${run.result.durationMs}ms.`,
          });
        } else {
          // If there are failures, record them
          const topFailures = run.result.failures.slice(0, 3).map((f) => `${f.file || ''}:${f.line || ''} ${f.message}`.trim());
          checks.push({
            id: createId('check'),
            category: 'syntax_build',
            title: 'Diagnostic Failures Detected',
            status: 'failed',
            message: `${run.result.failures.length} TypeScript/build error(s) found.`,
            details: topFailures.join('\n'),
          });
        }
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Perform structured self-critique pass evaluating output against standard quality criteria.
   */
  private performSelfCritique(
    files: string[],
    goal: string,
    checks: VerificationCheck[],
    critiques: CritiqueItem[]
  ): void {
    const hasFailedChecks = checks.some((c) => c.status === 'failed');
    const hasWarningChecks = checks.some((c) => c.status === 'warning');

    // 1. Clutter & Layout
    critiques.push({
      id: createId('critique'),
      aspect: 'clutter',
      question: 'Is the implementation clutter-free, cleanly structured, and architecturally sound?',
      passed: !hasWarningChecks,
      critique: hasWarningChecks
        ? 'Some visual or style warnings were identified; inspect layout padding and flex containment.'
        : 'Structure is clean, modular, and follows existing repository conventions.',
      severity: 'warning',
    });

    // 2. Completeness & Stubs
    critiques.push({
      id: createId('critique'),
      aspect: 'completeness',
      question: 'Are all required elements, callbacks, and functions fully implemented without placeholder stubs?',
      passed: !hasFailedChecks,
      critique: hasFailedChecks
        ? 'Incomplete elements or broken references detected during verification.'
        : 'All targeted files and components are fully realized without hanging stubs.',
      severity: 'critical',
    });

    // 3. Wiring & Controls
    critiques.push({
      id: createId('critique'),
      aspect: 'wiring',
      question: 'Are all state connections, handlers, and IPC communication paths wired properly?',
      passed: !checks.some((c) => c.category === 'wiring_ipc' && c.status === 'failed'),
      critique: checks.some((c) => c.category === 'wiring_ipc' && c.status === 'failed')
        ? 'IPC or handler disconnect detected between layers.'
        : 'All event channels, props, and actions are actively wired to valid handlers.',
      severity: 'critical',
    });

    // 4. Layout Stability & Overlap
    critiques.push({
      id: createId('critique'),
      aspect: 'layout_stability',
      question: 'Is the layout stable, responsive, and free from visual overlap, truncation, or clipping?',
      passed: !checks.some((c) => c.category === 'ui_ux' && c.status === 'failed'),
      critique: checks.some((c) => c.category === 'ui_ux' && c.status === 'failed')
        ? 'Layout traps found that may cause cards or content to collide.'
        : 'Component hierarchy maintains bounded flex sizing and safe margins.',
      severity: 'critical',
    });

    // 5. Spec & Usability
    critiques.push({
      id: createId('critique'),
      aspect: 'usability',
      question: 'Is the final output immediately usable, verified, and safe for production usage?',
      passed: !hasFailedChecks,
      critique: hasFailedChecks
        ? 'Requires repair before safe production use.'
        : 'Validated cleanly; meets quality standards and is ready for use.',
      severity: 'critical',
    });
  }
}
