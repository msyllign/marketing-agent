import React, { useState, useRef, useEffect } from 'react';
import { refineMessage } from '../services/api';
import { ChatMessage } from '../types';
import toast from 'react-hot-toast';

interface ChatInterfaceProps {
  message: string;
  personaName?: string;
  campaignId?: string;
  onRefinedMessage: (refined: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  message,
  personaName,
  campaignId,
  onRefinedMessage,
}) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Here's the message to refine:\n\n"${message}"\n\nWhat would you like to change?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Pass persona context so feedback gets stored
      const result = await refineMessage(message, input, personaName, campaignId);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.refinedMessage,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
      onRefinedMessage(result.refinedMessage);
    } catch {
      toast.error('Failed to refine message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-96 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              {msg.content}
              <span className="text-xs opacity-60 mt-1 block">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Describe changes… (stored for future campaigns)"
          disabled={loading}
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};
