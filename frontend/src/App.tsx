import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { MessageCard } from './components/MessageCard';
import { ChatInterface } from './components/ChatInterface';
import { generateMessages, approveMessage } from './services/api';
import { GeneratedMessage } from './types';
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
    } catch (error) {
      toast.error('Failed to generate messages');
    } finally {
      setLoading(false);
    }
  };

  const handleRefineMessage = (message: GeneratedMessage) => {
    setSelectedMessage(message);
    setRefinedMessage(null);
  };

  const handleApproveMessage = async (messageText: string) => {
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

    // Sync approval to backend
    try {
      await approveMessage(campaignId, msg.personaName, messageText);
    } catch {
      // Non-blocking — local state is already updated
    }
  };

  const handleExport = () => {
    const approved = messages.filter((m) => m.approved);
    if (approved.length === 0) return;

    // Build a clean export object
    const exportData = approved.map((m) => ({
      persona: m.personaName,
      message: m.message,
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
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-4">Generating messages...</p>
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
                  <h3 className="text-xl font-bold mb-4">Refine Message</h3>
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 font-medium mb-2">Current Message:</p>
                    <p className="text-sm text-gray-800">{selectedMessage.message}</p>
                  </div>
                  <ChatInterface
                    message={selectedMessage.message}
                    onRefinedMessage={setRefinedMessage}
                  />
                  {refinedMessage && (
                    <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                      <p className="text-sm text-green-700 font-medium mb-2">Refined Message:</p>
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
                  <p>Select a message to refine</p>
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
