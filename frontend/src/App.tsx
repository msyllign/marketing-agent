import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { MessageCard } from './components/MessageCard';
import { ChatInterface } from './components/ChatInterface';
import axios from 'axios';
import { generateMessages, approveMessage, rejectMessage } from './services/api';
import { GeneratedMessage, CriticScore } from './types';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GeneratedMessage | null>(null);
  const [refinedMessage, setRefinedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUploadSuccess = async (id: string, smsFile: string, personasFile: string) => {
    setCampaignId(id);
    setLoading(true);

    try {
      const result = await generateMessages(id, smsFile, personasFile);
      setMessages(result.messages);
      toast.success(`Generated ${result.messages.length} messages!`);
    } catch (error: unknown) {
      // Surface the actual backend error so the user knows what's wrong
      let msg = 'Failed to generate messages';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        msg = error.response.data.error;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      toast.error(msg, { duration: 8000 });
      console.error('[Generate]', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefineMessage = (message: GeneratedMessage) => {
    setSelectedMessage(message);
    setRefinedMessage(null);
  };

  const handleApproveMessage = async (messageText: string, criticScore?: CriticScore) => {
    // Find the persona name for this message
    const msg = messages.find((m) => m.message === messageText);
    if (!msg || !campaignId) return;

    // Update local state immediately
    setMessages((prev) =>
      prev.map((m) =>
        m.message === messageText ? { ...m, approved: true } : m
      )
    );
    toast.success('Message approved!');

    // Sync approval to backend (stores in FeedbackStore)
    try {
      await approveMessage(campaignId, msg.personaName, messageText, criticScore);
    } catch {
      // Non-blocking — local state is already updated
    }
  };

  const handleDiscardMessage = async (message: GeneratedMessage) => {
    if (!campaignId) return;

    // Remove from local state
    setMessages((prev) => prev.filter((m) => m !== message));

    // Clear refinement panel if this message was selected
    if (selectedMessage === message) {
      setSelectedMessage(null);
      setRefinedMessage(null);
    }

    toast('Message discarded', { icon: '🗑' });

    // Store rejection in FeedbackStore
    try {
      await rejectMessage(campaignId, message.personaName, message.message, message.criticScore);
    } catch {
      // Non-blocking
    }
  };

  const handleExport = () => {
    const approved = messages.filter((m) => m.approved);
    if (approved.length === 0) return;

    // Build a clean export object
    const exportData = approved.map((m) => ({
      persona: m.personaName,
      message: m.message,
      criticScore: m.criticScore,
    }));

    // Trigger JSON download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approved-messages-${campaignId?.slice(0, 8) ?? 'campaign'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${approved.length} approved messages`);
  };

  const approvedCount = messages.filter((m) => m.approved).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Toaster position="top-right" />

      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Marketing Agent</h1>
          <p className="text-gray-600">Generate and refine personalized SMS messages at scale</p>
        </header>

        {!campaignId ? (
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Messages List */}
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-md mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">
                    Generated Messages ({approvedCount}/{messages.length} approved)
                  </h2>
                  {approvedCount > 0 && (
                    <button
                      onClick={handleExport}
                      className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
                    >
                      ⬇️ Export ({approvedCount})
                    </button>
                  )}
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-4 font-medium">
                        Generating &amp; scoring messages with AI critic…
                      </p>
                      <p className="text-gray-400 text-xs mt-2">
                        This can take 1–3 minutes for multiple personas. Please keep this tab open.
                      </p>
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No messages generated yet</p>
                  ) : (
                    messages.map((msg, idx) => (
                      <MessageCard
                        key={idx}
                        message={msg}
                        onRefine={handleRefineMessage}
                        onApprove={handleApproveMessage}
                        onDiscard={handleDiscardMessage}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Refinement Panel */}
            <div className="lg:col-span-1">
              {selectedMessage ? (
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-xl font-bold mb-1">Refine Message</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Persona: <span className="font-medium text-gray-700">{selectedMessage.personaName}</span>
                  </p>
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 font-medium mb-2">Current Message:</p>
                    <p className="text-sm text-gray-800">{selectedMessage.message}</p>
                  </div>
                  <ChatInterface
                    message={selectedMessage.message}
                    personaName={selectedMessage.personaName}
                    campaignId={campaignId ?? undefined}
                    onRefinedMessage={(refined) => {
                      setRefinedMessage(refined);
                      // Also update the message in the list to reflect the refined text
                      setMessages((prev) =>
                        prev.map((m) =>
                          m === selectedMessage ? { ...m, message: refined } : m
                        )
                      );
                      setSelectedMessage((prev) =>
                        prev ? { ...prev, message: refined } : prev
                      );
                    }}
                  />
                  {refinedMessage && (
                    <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                      <p className="text-sm text-green-700 font-medium mb-2">✓ Message updated</p>
                      <p className="text-sm text-gray-800">{refinedMessage}</p>
                      <button
                        onClick={() => handleApproveMessage(refinedMessage)}
                        className="mt-3 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors"
                      >
                        ✓ Approve Refined
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
                  <div className="text-4xl mb-3">✏️</div>
                  <p className="font-medium">Select a message to refine</p>
                  <p className="text-xs mt-2">Your feedback is stored and used to improve future campaigns</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
