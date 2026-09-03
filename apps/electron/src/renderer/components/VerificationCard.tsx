import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  FileCode,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { VerificationReport, VerificationCheck, CritiqueItem, RepairAttempt } from '@cluster/shared';

export interface VerificationCardProps {
  report: VerificationReport;
  dense?: boolean;
}

export const VerificationCard: React.FC<VerificationCardProps> = ({ report, dense }) => {
  const [showChecks, setShowChecks] = useState(true);
  const [showCritiques, setShowCritiques] = useState(false);
  const [showRepairs, setShowRepairs] = useState(true);

  const passedChecks = report.checks.filter((c) => c.status === 'passed').length;
  const failedChecks = report.checks.filter((c) => c.status === 'failed').length;
  const warningChecks = report.checks.filter((c) => c.status === 'warning').length;

  const isAccepted = report.gateAccepted;
  const isNeedsWork = report.status === 'needs-work';

  return (
    <div className="w-full my-3 rounded-xl border border-[#27272a] bg-[#121216] overflow-hidden shadow-lg transition-all">
      {/* Header Banner */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
          isAccepted
            ? 'bg-emerald-950/25 border-emerald-800/40 text-emerald-300'
            : isNeedsWork
            ? 'bg-amber-950/25 border-amber-800/40 text-amber-300'
            : 'bg-rose-950/25 border-rose-800/40 text-rose-300'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg ${
              isAccepted
                ? 'bg-emerald-500/20 text-emerald-400'
                : isNeedsWork
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {isAccepted ? (
              <ShieldCheck className="w-4 h-4" />
            ) : isNeedsWork ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <ShieldAlert className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wide flex items-center gap-2">
              <span>
                {isAccepted
                  ? 'Verification Gate: Accepted'
                  : isNeedsWork
                  ? 'Verification Gate: Needs Work'
                  : 'Verification Incomplete'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/10 uppercase">
                Single-Agent Quality Gate
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">{report.summary}</div>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {passedChecks} passed
          </span>
          {warningChecks > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-700/50 text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              {warningChecks} warn
            </span>
          )}
          {failedChecks > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-700/50 text-rose-300 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-400" />
              {failedChecks} fail
            </span>
          )}
          {report.repairs.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-700/50 text-cyan-300 flex items-center gap-1">
              <Wrench className="w-3 h-3 text-cyan-400" />
              {report.repairs.length} repaired
            </span>
          )}
        </div>
      </div>

      {/* Target Files Strip */}
      {report.targetFiles.length > 0 && (
        <div className="px-4 py-2 border-b border-[#222226] bg-[#0c0c10] flex items-center gap-2 text-[11px] text-zinc-400 overflow-x-auto">
          <FileCode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="shrink-0 font-medium text-zinc-300">Files Inspected:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {report.targetFiles.map((file, idx) => (
              <span
                key={idx}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#18181f] border border-[#2e2e36] text-zinc-300"
              >
                {file}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content Sections */}
      <div className="p-3.5 space-y-3 text-xs">
        {/* Section 1: Detailed Checks */}
        <div className="border border-[#232328] rounded-lg bg-[#0e0e12] overflow-hidden">
          <button
            onClick={() => setShowChecks(!showChecks)}
            className="w-full px-3 py-2 flex items-center justify-between text-left text-zinc-300 hover:text-white bg-[#14141a] hover:bg-[#1a1a22] transition-colors"
          >
            <div className="flex items-center gap-2 font-medium">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Automated Verification Checks ({report.checks.length})</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-400">
              {showChecks ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          </button>

          {showChecks && (
            <div className="divide-y divide-[#1e1e24] p-1">
              {report.checks.map((check) => {
                const isPass = check.status === 'passed';
                const isWarn = check.status === 'warning';
                return (
                  <div key={check.id} className="p-2.5 flex items-start justify-between gap-3 text-[11px]">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {isPass ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isWarn ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-200 flex items-center gap-1.5 flex-wrap">
                          <span>{check.title}</span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800/70 text-zinc-400 uppercase">
                            {check.category}
                          </span>
                          {check.file && (
                            <span className="text-[10px] font-mono text-cyan-400 truncate max-w-[200px]">
                              {check.file}
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 mt-0.5 leading-relaxed">{check.message}</p>
                        {check.details && (
                          <pre className="mt-1 p-1.5 rounded bg-black/40 text-[10px] font-mono text-zinc-400 overflow-x-auto">
                            {check.details}
                          </pre>
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0 uppercase ${
                        isPass
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                          : isWarn
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Self-Critique Checklist */}
        {report.critiques.length > 0 && (
          <div className="border border-[#232328] rounded-lg bg-[#0e0e12] overflow-hidden">
            <button
              onClick={() => setShowCritiques(!showCritiques)}
              className="w-full px-3 py-2 flex items-center justify-between text-left text-zinc-300 hover:text-white bg-[#14141a] hover:bg-[#1a1a22] transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Self-Critique Review ({report.critiques.length} criteria)</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                {showCritiques ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showCritiques && (
              <div className="divide-y divide-[#1e1e24] p-1">
                {report.critiques.map((item) => (
                  <div key={item.id} className="p-2.5 flex items-start gap-2.5 text-[11px]">
                    <div className="mt-0.5 shrink-0">
                      {item.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : item.severity === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-zinc-200">{item.question}</div>
                      <div className="text-zinc-400 mt-0.5">{item.critique}</div>
                    </div>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400 uppercase">
                      {item.aspect}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 3: Automatic Repairs Applied */}
        {report.repairs.length > 0 && (
          <div className="border border-cyan-900/40 rounded-lg bg-[#0c1218] overflow-hidden">
            <button
              onClick={() => setShowRepairs(!showRepairs)}
              className="w-full px-3 py-2 flex items-center justify-between text-left text-cyan-200 hover:text-white bg-cyan-950/40 hover:bg-cyan-950/60 transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                <span>Automatic Self-Repairs Applied ({report.repairs.length} passes)</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-cyan-400">
                {showRepairs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </div>
            </button>

            {showRepairs && (
              <div className="divide-y divide-cyan-950/50 p-2 space-y-2">
                {report.repairs.map((repair) => (
                  <div key={repair.attempt} className="p-2 rounded bg-[#101720] border border-cyan-900/30 text-[11px]">
                    <div className="flex items-center justify-between font-semibold text-cyan-300">
                      <span>Repair Pass #{repair.attempt}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{repair.timestamp.slice(11, 19)}</span>
                    </div>
                    <div className="text-zinc-300 mt-1">
                      <strong>Addressed issues:</strong> {repair.issuesAddressed.join(', ') || 'Diagnostic fixes'}
                    </div>
                    {repair.actionsTaken.length > 0 && (
                      <div className="text-zinc-400 mt-0.5">
                        <strong>Actions:</strong> {repair.actionsTaken.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Gate Assessment */}
      <div className="px-4 py-2 bg-[#09090c] border-t border-[#1f1f24] flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <span>Gate Status: {isAccepted ? '✓ Safe for production use' : '⚠ Action required before deployment'}</span>
        <span>{new Date(report.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
