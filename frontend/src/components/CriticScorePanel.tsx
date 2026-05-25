import React, { useState } from 'react';
import type { CriticScore } from '../types';

interface CriticScorePanelProps {
  criticScore: CriticScore;
  refinementIterations?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function qualityBadge(score: number) {
  if (score >= 8) return { bg: 'bg-green-100 text-green-800 border-green-300',  label: 'Excellent' };
  if (score >= 6) return { bg: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Good' };
  if (score >= 4) return { bg: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Fair' };
  return           { bg: 'bg-red-100 text-red-800 border-red-300',               label: 'Poor' };
}

function complianceBadge(score: number) {
  if (score >= 8) return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Compliant' };
  if (score >= 6) return { bg: 'bg-amber-100 text-amber-800 border-amber-300',       label: 'Mostly OK' };
  if (score >= 4) return { bg: 'bg-orange-100 text-orange-800 border-orange-300',    label: 'Issues' };
  return           { bg: 'bg-red-100 text-red-800 border-red-300',                   label: 'Non-compliant' };
}

function approvalBadge(prob: number) {
  if (prob >= 80) return { bg: 'bg-green-100 text-green-800 border-green-300',   bar: 'bg-green-500' };
  if (prob >= 60) return { bg: 'bg-yellow-100 text-yellow-800 border-yellow-300', bar: 'bg-yellow-500' };
  if (prob >= 40) return { bg: 'bg-orange-100 text-orange-800 border-orange-300', bar: 'bg-orange-500' };
  return           { bg: 'bg-red-100 text-red-800 border-red-300',                bar: 'bg-red-500' };
}

// ── Component ────────────────────────────────────────────────────────────────

export const CriticScorePanel: React.FC<CriticScorePanelProps> = ({
  criticScore,
  refinementIterations,
}) => {
  const [expanded, setExpanded] = useState(false);
  const {
    score,
    complianceScore,
    approvalProbability,
    strengths,
    complianceViolations,
    improvements,
  } = criticScore;

  const qb = qualityBadge(score);
  const cb = complianceBadge(complianceScore);
  const ab = approvalBadge(approvalProbability);

  return (
    <div className="mt-2 mb-3 space-y-2">

      {/* ── Row 1: quality + compliance badges ── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Quality */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${qb.bg}`}>
          🤖 Quality {score}/10
          <span className="font-normal opacity-75">· {qb.label}</span>
        </span>

        {/* Compliance */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${cb.bg}`}>
          📋 Compliance {complianceScore}/10
          <span className="font-normal opacity-75">· {cb.label}</span>
        </span>

        {/* Refined badge */}
        {refinementIterations !== undefined && refinementIterations > 1 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs text-indigo-700 bg-indigo-50 border-indigo-200">
            🔄 Refined {refinementIterations - 1}×
          </span>
        )}
      </div>

      {/* ── Row 2: approval probability bar ── */}
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs font-medium ${ab.bg}`}>
        <span className="shrink-0 font-semibold">⚖️ Compliance Approval</span>
        <div className="flex-1 bg-white bg-opacity-60 rounded-full h-2 min-w-0">
          <div
            className={`h-2 rounded-full transition-all ${ab.bar}`}
            style={{ width: `${approvalProbability}%` }}
          />
        </div>
        <span className="shrink-0 font-bold tabular-nums">{approvalProbability}%</span>
      </div>

      {/* ── Expand / collapse ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-gray-500 hover:text-gray-700 underline"
      >
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="text-xs space-y-2 pl-1 pt-1 border-l-2 border-gray-200">

          {strengths.length > 0 && (
            <div>
              <p className="font-semibold text-green-700 mb-0.5">✓ Strengths</p>
              <ul className="space-y-0.5">
                {strengths.map((s, i) => (
                  <li key={i} className="text-gray-700 pl-2">· {s}</li>
                ))}
              </ul>
            </div>
          )}

          {complianceViolations.length > 0 && (
            <div>
              <p className="font-semibold text-red-700 mb-0.5">⚠ Compliance Violations</p>
              <ul className="space-y-0.5">
                {complianceViolations.map((v, i) => (
                  <li key={i} className="text-red-700 pl-2">· {v}</li>
                ))}
              </ul>
            </div>
          )}

          {improvements.length > 0 && (
            <div>
              <p className="font-semibold text-amber-700 mb-0.5">↑ Improvements needed</p>
              <ul className="space-y-0.5">
                {improvements.map((imp, i) => (
                  <li key={i} className="text-gray-700 pl-2">· {imp}</li>
                ))}
              </ul>
            </div>
          )}

          {complianceViolations.length === 0 && improvements.length === 0 && (
            <p className="text-green-700">✓ No violations — message is fully compliant.</p>
          )}
        </div>
      )}
    </div>
  );
};
