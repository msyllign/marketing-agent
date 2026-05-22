import React from 'react';
import { GeneratedMessage } from '../types';

interface MessageCardProps {
  message: GeneratedMessage;
  onRefine: (message: GeneratedMessage) => void;
  onApprove: (message: string) => void;
}

export const MessageCard: React.FC<MessageCardProps> = ({ message, onRefine, onApprove }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600 hover:shadow-lg transition-shadow">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800">{message.personaName}</h3>
        <div className="text-sm text-gray-600 mt-2">
          <p className="font-mono text-xs bg-gray-50 p-2 rounded">
            {Object.entries(message.persona)
              .map(([key, value]) => `${key}: ${value}`)
              .join(' | ')}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded mb-4 border-l-2 border-gray-300">
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.message}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onRefine(message)}
          className="flex-1 bg-yellow-500 text-white py-2 rounded hover:bg-yellow-600 transition-colors font-medium"
        >
          ✏️ Refine
        </button>
        <button
          onClick={() => onApprove(message.message)}
          disabled={message.approved}
          className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          {message.approved ? '✓ Approved' : '✓ Approve'}
        </button>
      </div>
    </div>
  );
};
