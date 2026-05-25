import axios from 'axios';
import type { CriticScore, GeneratedMessage } from '../types';

const API_URL =
  process.env.REACT_APP_API_URL ||
  'https://marketing-agent-production-3f2a.up.railway.app/api';

const api = axios.create({ baseURL: API_URL });

export async function uploadFiles(smsTemplate: File, personasFile: File) {
  const formData = new FormData();
  formData.append('smsTemplate', smsTemplate);
  formData.append('personasFile', personasFile);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Start an async generation job.
 *
 * Returns either:
 *  { cached: true, messages, count }   – previous approved messages found
 *  { jobId, count }                    – job started; poll /api/jobs/:jobId
 */
export async function startGeneration(
  campaignId: string,
  smsTemplateFile: string,
  personasFile: string,
  segment: string,
  product: string
): Promise<
  | { cached: true; messages: GeneratedMessage[]; count: number }
  | { cached?: false; jobId: string; count: number }
> {
  const response = await api.post(
    '/generate',
    { campaignId, smsTemplateFile, personasFile, segment, product },
    { timeout: 30_000 } // just needs to start the job — 30 s is plenty
  );
  return response.data;
}

/** Poll a running generation job. */
export async function pollJob(jobId: string): Promise<{
  id: string;
  status: 'running' | 'done' | 'error';
  messages: GeneratedMessage[];
  error?: string;
  completedCount: number;
  totalCount: number;
}> {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
}

export async function refineMessage(
  message: string,
  feedback: string,
  personaName?: string,
  campaignId?: string
) {
  const response = await api.post('/chat/refine', {
    message,
    feedback,
    personaName,
    campaignId,
  });
  return response.data;
}

export async function approveMessage(
  campaignId: string,
  personaName: string,
  message: string,
  criticScore?: CriticScore
) {
  const response = await api.post('/approval/approve', {
    campaignId,
    personaName,
    message,
    criticScore,
  });
  return response.data;
}

export async function rejectMessage(
  campaignId: string,
  personaName: string,
  message: string,
  criticScore?: CriticScore
) {
  const response = await api.post('/feedback/reject', {
    campaignId,
    personaName,
    message,
    criticScore,
  });
  return response.data;
}

export async function exportApprovedMessages(campaignId: string) {
  const response = await api.get(`/approval/export/${campaignId}`);
  return response.data;
}

export async function getPersonaFeedback(personaName: string) {
  const response = await api.get(
    `/feedback/${encodeURIComponent(personaName)}`
  );
  return response.data;
}
