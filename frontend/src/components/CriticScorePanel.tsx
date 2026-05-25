import React, { useState } from 'react';
import type { CriticScore } from '../types';

interface CriticScorePanelProps {
  criticScore: CriticScore;
  refinementIterations?: number;
}

function scoreBadgeClass(score: number): string {
  if (score >= 8) return 'bg-green-100 text-green-800 border-green-300';
  if (score >= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-red-100 text-red-800 border-red-300';
}

function scoreLabel(score: number): string {
  if (score >= 9) return 'Excellent';
  if (score >= 8) return 'Very Good';
  if (score >= 7) return 'Good';
  if (score >= 5) return 'Fair';
  return 'Poor';
}

export const CriticScorePanel: React.FC<CriticScorePanelProps> = ({
  criticScore,
  refinementIterations,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { score, strengths, improvements } = criticScore;

  return (
    <div className="mt-2 mb-3">
      {/* Score row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${scoreBadgeClass(score)}`}
        >
          🤖 {score}/10 · {scoreLabel(score)}
        </span>

        {refinementIterations !== undefined && refinementIterations > 1 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs text-indigo-700 bg-indigo-50 border-indigo-200">
            🔄 Refined {refinementIterations - 1}×
          </span>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 text-xs space-y-1 pl-1">
          {strengths.length > 0 && (
            <div>
              <span className="font-semibold text-green-700">✓ Strengths: </span>
              <span className="text-gray-700">{strengths.join(' · ')}</span>
            </div>
          )}
          {improvements.length > 0 && score < 7 && (
            <div>
              <span className="font-semibold text-red-600">↑ Improvements: </span>
              <span className="text-gray-700">{improvements.join(' · ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
