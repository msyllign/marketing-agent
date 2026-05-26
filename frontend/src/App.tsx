import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { MessageCard } from './components/MessageCard';
import { ChatInterface } from './components/ChatInterface';
import axios from 'axios';
import { startGeneration, pollJob, approveMessage, rejectMessage, unapproveMessage } from './services/api';
import { GeneratedMessage, CriticScore } from './types';
import toast, { Toaster } from 'react-hot-toast';

// Tracks files after upload but before generation
interface UploadedFiles {
  campaignId: string;
  smsFile: string;
  personasFile: string;
}

type AppPhase = 'upload' | 'ready' | 'generating' | 'done';

const SEGMENTS = ['Premium', 'Mass', 'Business'] as const;
const PRODUCTS = ['Credit Cards', 'Mutual Funds', 'Safe Wallet'] as const;
const POLL_INTERVAL_MS = 3_000;

function App() {
  const [phase, setPhase] = useState<AppPhase>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles | null>(null);
  const [segment, setSegment] = useState('');
  const [product, setProduct] = useState('');
  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GeneratedMessage | null>(null);
  const [refinedMessage, setRefinedMessage] = useState<string | null>(null);

  // Job polling state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup poll on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Polling loop ───────────────────────────────────────────────────────────
  function startPolling(id: string, total: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    setJobProgress({ completed: 0, total });

    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJob(id);
        setJobProgress({ completed: job.completedCount, total: job.totalCount });

        if (job.status === 'done') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setMessages(job.messages);
          setPhase('done');
          toast.success(`Generated ${job.messages.length} messages!`);
        } else if (job.status === 'error') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          toast.error(job.error ?? 'Generation failed', { duration: 10_000 });
          setPhase('ready');
        }
      } catch (err) {
        // Network hiccup — keep polling
        console.warn('[Poll] temporary error', err);
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Step 1: Upload ──────────────────────────────────────────────────────────
  const handleUploadSuccess = (id: string, smsFile: string, personasFile: string) => {
    setUploadedFiles({ campaignId: id, smsFile, personasFile });
    setPhase('ready');
    toast.success('Files uploaded! Select segment & product, then generate.');
  };

  // ── Step 2: Generate ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!uploadedFiles || !segment || !product) return;
    setPhase('generating');
    setMessages([]);
    setJobId(null);

    try {
      const result = await startGeneration(
        uploadedFiles.campaignId,
        uploadedFiles.smsFile,
        uploadedFiles.personasFile,
        segment,
        product
      );

      // ── Cache hit: restore the previous campaign ────────────────────────────
      if (result.cached) {
        // Replace the temporary upload campaignId with the original one so that
        // subsequent approvals and refinements write to the correct campaign file.
        setUploadedFiles((prev) =>
          prev ? { ...prev, campaignId: result.campaignId } : prev
        );
        setMessages(result.messages);
        setPhase('done');
        const { approvedCount, count } = result;
        toast.success(
          `📋 Previous campaign restored — ${approvedCount} of ${count} message${count !== 1 ? 's' : ''} already approved`,
          { duration: 6_000 }
        );
        return;
      }

      // ── Job started: begin polling ──────────────────────────────────────────
      setJobId(result.jobId);
      startPolling(result.jobId, result.count);

    } catch (error: unknown) {
      let msg = 'Failed to start generation';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        msg = error.response.data.error;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      toast.error(msg, { duration: 10_000 });
      console.error('[Generate]', error);
      setPhase('ready');
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
      await approveMessage(uploadedFiles.campaignId, msg.personaName, messageText, criticScore);
    } catch {
      // non-blocking
    }
  };

  const handleUnapproveMessage = async (message: GeneratedMessage) => {
    if (!uploadedFiles) return;
    setMessages((prev) =>
      prev.map((m) => (m === message ? { ...m, approved: false } : m))
    );
    toast('Message unapproved — you can now refine or re-approve it', { icon: '↩' });
    try {
      await unapproveMessage(uploadedFiles.campaignId, message.personaName, message.message);
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
      await rejectMessage(uploadedFiles.campaignId, message.personaName, message.message, message.criticScore);
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
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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
            Generate and refine personalized Viber messages at scale
          </p>
        </header>

        {/* ── Phase: upload ── */}
        {phase === 'upload' && (
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        )}

        {/* ── Phase: ready — select segment & product, then generate ── */}
        {phase === 'ready' && uploadedFiles && (
          <div className="max-w-lg mx-auto bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">✅</div>
              <h2 className="text-2xl font-bold text-gray-800">Files Uploaded</h2>
              <p className="text-gray-500 text-sm mt-1">
                Select the target segment and product, then generate.
              </p>
            </div>

            {/* Segment */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Customer Segment
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select segment —</option>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Product
              </label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select product —</option>
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Selected summary */}
            {segment && product && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
                🎯 <strong>{segment}</strong> segment · <strong>{product}</strong>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!segment || !product}
              className="w-full bg-blue-600 text-white py-3 rounded-lg text-base font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              🚀 Generate Messages
            </button>
            <p className="text-center text-gray-400 text-xs mt-2">
              Takes 1–3 min · results appear as each persona completes
            </p>
            <button
              onClick={() => { setUploadedFiles(null); setPhase('upload'); }}
              className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Upload different files
            </button>
          </div>
        )}

        {/* ── Phase: generating — show live progress ── */}
        {phase === 'generating' && (
          <div className="max-w-lg mx-auto bg-white p-10 rounded-lg shadow-md text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-600 border-t-transparent mx-auto mb-6" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              AI Critic Loop Running…
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Copywriter → Critic → Refinement for each persona
            </p>

            {/* Progress bar */}
            {jobProgress.total > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Personas complete</span>
                  <span className="font-semibold tabular-nums">
                    {jobProgress.completed} / {jobProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((jobProgress.completed / jobProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Results will appear automatically · safe to minimize this tab
                </p>
              </div>
            )}

            {jobId && (
              <p className="text-xs text-gray-300 mt-4 font-mono">job: {jobId}</p>
            )}
          </div>
        )}

        {/* ── Phase: done ── */}
        {phase === 'done' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Messages List */}
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-lg shadow-md mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">
                      Messages ({approvedCount}/{messages.length} approved)
                    </h2>
                    {segment && product && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {segment} · {product}
                      </p>
                    )}
                  </div>
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
                        onUnapprove={handleUnapproveMessage}
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
