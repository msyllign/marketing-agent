import React from 'react';
import { GeneratedMessage, CriticScore } from '../types';
import { CriticScorePanel } from './CriticScorePanel';

interface MessageCardProps {
  message: GeneratedMessage;
  onRefine: (message: GeneratedMessage) => void;
  onApprove: (message: string, criticScore?: CriticScore) => void;
  onDiscard: (message: GeneratedMessage) => void;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  onRefine,
  onApprove,
  onDiscard,
}) => {
  return (
    <div
      className={`bg-white p-5 rounded-lg shadow-md border-l-4 transition-shadow hover:shadow-lg ${
        message.approved ? 'border-green-500' : 'border-blue-500'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-bold text-gray-800">{message.personaName}</h3>
        {message.approved && (
          <span className="text-xs bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded font-medium">
            ✓ Approved
          </span>
        )}
      </div>

      {/* Critic score badge */}
      {message.criticScore && (
        <CriticScorePanel
          criticScore={message.criticScore}
          refinementIterations={message.refinementIterations}
        />
      )}

      {/* Message text */}
      <div className="bg-gray-50 p-3 rounded mb-4 border-l-2 border-gray-300">
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.message}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onDiscard(message)}
          disabled={message.approved}
          className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded hover:bg-gray-300 disabled:opacity-40 transition-colors text-sm font-medium"
        >
          🗑 Discard
        </button>
        <button
          onClick={() => onRefine(message)}
          disabled={message.approved}
          className="flex-1 bg-yellow-500 text-white py-1.5 rounded hover:bg-yellow-600 disabled:opacity-40 transition-colors text-sm font-medium"
        >
          ✏️ Refine
        </button>
        <button
          onClick={() => onApprove(message.message, message.criticScore)}
          disabled={message.approved}
          className="flex-1 bg-green-600 text-white py-1.5 rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
        >
          {message.approved ? '✓ Approved' : '✓ Approve'}
        </button>
      </div>
    </div>
  );
};
