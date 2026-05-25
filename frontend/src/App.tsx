import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { MessageCard } from './components/MessageCard';
import { ChatInterface } from './components/ChatInterface';
import axios from 'axios';
import { generateMessages, approveMessage, rejectMessage } from './services/api';
import { GeneratedMessage, CriticScore } from './types';
import toast, { Toaster } from 'react-hot-toast';

// Tracks files after upload but before generation
interface UploadedFiles {
  campaignId: string;
  smsFile: string;
  personasFile: string;
}

type AppPhase = 'upload' | 'ready' | 'generating' | 'done';

function App() {
  const [phase, setPhase] = useState<AppPhase>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles | null>(null);
  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GeneratedMessage | null>(null);
  const [refinedMessage, setRefinedMessage] = useState<string | null>(null);

  // ── Step 1: Upload ──────────────────────────────────────────────────────────
  const handleUploadSuccess = (id: string, smsFile: string, personasFile: string) => {
    setUploadedFiles({ campaignId: id, smsFile, personasFile });
    setPhase('ready');
    toast.success('Files uploaded! Click Generate to start.');
  };

  // ── Step 2: Generate ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!uploadedFiles) return;
    setPhase('generating');

    try {
      const result = await generateMessages(
        uploadedFiles.campaignId,
        uploadedFiles.smsFile,
        uploadedFiles.personasFile
      );
      setMessages(result.messages);
      setPhase('done');
      toast.success(`Generated ${result.messages.length} messages!`);
    } catch (error: unknown) {
      let msg = 'Failed to generate messages';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        msg = error.response.data.error;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      toast.error(msg, { duration: 10000 });
      console.error('[Generate]', error);
      setPhase('ready'); // allow retry
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleRefineMessage = (message: GeneratedMessage) => {
    setSelectedMessage(message);
    setRefinedMessage(null);
  };

  const handleApproveMessage = async (messageText: string, criticScore?: CriticScore) => {
    const msg = messages.find((m) => m.message === messageText);
    if (!msg || !uploadedFiles) return;

    setMessages((prev) =>
      prev.map((m) => (m.message === messageText ? { ...m, approved: true } : m))
    );
    toast.success('Message approved!');

    try {
      await approveMessage(
        uploadedFiles.campaignId,
        msg.personaName,
        messageText,
        criticScore
      );
    } catch {
      // non-blocking
    }
  };

  const handleDiscardMessage = async (message: GeneratedMessage) => {
    if (!uploadedFiles) return;
    setMessages((prev) => prev.filter((m) => m !== message));
    if (selectedMessage === message) {
      setSelectedMessage(null);
      setRefinedMessage(null);
    }
    toast('Message discarded', { icon: '🗑' });
    try {
      await rejectMessage(
        uploadedFiles.campaignId,
        message.personaName,
        message.message,
        message.criticScore
      );
    } catch {
      // non-blocking
    }
  };

  const handleExport = () => {
    const approved = messages.filter((m) => m.approved);
    if (approved.length === 0) return;
    const exportData = approved.map((m) => ({
      persona: m.personaName,
      message: m.message,
      criticScore: m.criticScore,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approved-messages-${uploadedFiles?.campaignId.slice(0, 8) ?? 'campaign'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${approved.length} approved messages`);
  };

  const approvedCount = messages.filter((m) => m.approved).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Toaster position="top-right" />

      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Marketing Agent</h1>
          <p className="text-gray-600">
            Generate and refine personalized SMS messages at scale
          </p>
        </header>

        {/* ── Phase: upload ── */}
        {phase === 'upload' && (
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        )}

        {/* ── Phase: ready (upload done, waiting for user to click Generate) ── */}
        {phase === 'ready' && uploadedFiles && (
          <div className="max-w-lg mx-auto bg-white p-8 rounded-lg shadow-md text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Files Uploaded</h2>
            <p className="text-gray-500 mb-6 text-sm">
              The AI critic loop will generate and score a personalized message for each
              persona. This takes <strong>1–3 minutes</strong> — keep the tab open.
            </p>
            <button
              onClick={handleGenerate}
              className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              🚀 Generate Messages
            </button>
            <button
              onClick={() => { setUploadedFiles(null); setPhase('upload'); }}
              className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Upload different files
            </button>
          </div>
        )}

        {/* ── Phase: generating ── */}
        {phase === 'generating' && (
          <div className="max-w-lg mx-auto bg-white p-10 rounded-lg shadow-md text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent mx-auto mb-6" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              AI Critic Loop Running…
            </h2>
            <p className="text-gray-500 text-sm mb-1">
              Copywriter → Critic → Refinement for each persona
            </p>
            <p className="text-gray-400 text-xs">
              Please keep this tab open. Results will appear automatically.
            </p>
          </div>
        )}

        {/* ── Phase: done ── */}
        {phase === 'done' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Messages List */}
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-md mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">
                    Messages ({approvedCount}/{messages.length} approved)
                  </h2>
                  <div className="flex gap-2">
                    {approvedCount > 0 && (
                      <button
                        onClick={handleExport}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors text-sm font-medium"
                      >
                        ⬇️ Export ({approvedCount})
                      </button>
                    )}
                    <button
                      onClick={() => { setMessages([]); setUploadedFiles(null); setPhase('upload'); }}
                      className="bg-gray-200 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-300 transition-colors text-sm"
                    >
                      New Campaign
                    </button>
                  </div>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No messages — all were discarded.
                    </p>
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
                    Persona:{' '}
                    <span className="font-medium text-gray-700">
                      {selectedMessage.personaName}
                    </span>
                  </p>
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600 font-medium mb-2">Current Message:</p>
                    <p className="text-sm text-gray-800">{selectedMessage.message}</p>
                  </div>
                  <ChatInterface
                    message={selectedMessage.message}
                    personaName={selectedMessage.personaName}
                    campaignId={uploadedFiles?.campaignId}
                    onRefinedMessage={(refined) => {
                      setRefinedMessage(refined);
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
                  <p className="text-xs mt-2">
                    Your feedback is stored and used to improve future campaigns
                  </p>
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
