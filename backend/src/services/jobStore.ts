/**
 * In-memory job store for async generation tasks.
 *
 * Keeps Railway's 60-second HTTP timeout from killing long-running
 * generation requests. The POST /generate route starts a job and returns
 * the jobId immediately; the frontend polls GET /api/jobs/:jobId.
 *
 * Jobs are kept for JOB_TTL_MS after completion, then auto-purged.
 */

import type { GeneratedMessage } from '../types';

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface Job {
  id: string;
  status: JobStatus;
  messages: GeneratedMessage[];
  error?: string;
  completedCount: number;
  totalCount: number;
  createdAt: number;
  finishedAt?: number;
}

const jobs = new Map<string, Job>();

// ── Purge old finished jobs periodically ────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(id);
  }
}, 10 * 60 * 1000); // check every 10 min

// ── Public API ───────────────────────────────────────────────────────────────

export function createJob(jobId: string, totalCount: number): Job {
  const job: Job = {
    id: jobId,
    status: 'running',
    messages: [],
    completedCount: 0,
    totalCount,
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);
  return job;
}

export function addJobMessage(jobId: string, msg: GeneratedMessage): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.messages.push(msg);
  job.completedCount = job.messages.length;
}

export function completeJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'done';
  job.finishedAt = Date.now();
}

export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'error';
  job.error = error;
  job.finishedAt = Date.now();
}

export function getJob(jobId: string): Job | null {
  return jobs.get(jobId) ?? null;
}
