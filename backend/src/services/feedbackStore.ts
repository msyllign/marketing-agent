import * as fs from 'fs';
import * as path from 'path';
import type { FeedbackRecord, FeedbackStore } from '../types';

const STORE_DIR = path.join(__dirname, '../../feedback_store');
const STORE_FILE = path.join(STORE_DIR, 'feedback.json');
const MAX_RECORDS_PER_PERSONA = 20;

// ── I/O helpers ──────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function loadStore(): FeedbackStore {
  ensureDir();
  if (!fs.existsSync(STORE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as FeedbackStore;
  } catch {
    return {};
  }
}

function saveStore(store: FeedbackStore): void {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a feedback record for a persona.
 * Caps the list at MAX_RECORDS_PER_PERSONA (most-recent retained).
 */
export function appendFeedback(record: FeedbackRecord): void {
  const store = loadStore();
  if (!store[record.personaName]) store[record.personaName] = [];

  store[record.personaName].push(record);

  // Keep only the most recent N records
  if (store[record.personaName].length > MAX_RECORDS_PER_PERSONA) {
    store[record.personaName] = store[record.personaName].slice(
      -MAX_RECORDS_PER_PERSONA
    );
  }

  saveStore(store);
}

/**
 * Return all feedback records for a persona (most recent first).
 */
export function loadFeedbackForPersona(personaName: string): FeedbackRecord[] {
  const store = loadStore();
  return [...(store[personaName] ?? [])].reverse();
}

/**
 * Return only approved records for a persona.
 */
export function getApprovedMessages(personaName: string): FeedbackRecord[] {
  return loadFeedbackForPersona(personaName).filter((r) => r.type === 'approved');
}

/**
 * Build a human-readable context block to inject into Copywriter prompts.
 * Returns empty string when no history exists.
 */
export function buildFeedbackContext(personaName: string): string {
  const records = loadFeedbackForPersona(personaName).slice(0, 6); // last 6
  if (records.length === 0) return '';

  const lines: string[] = [
    `--- PAST FEEDBACK FOR PERSONA "${personaName}" ---`,
  ];

  for (const r of records) {
    const date = r.timestamp.slice(0, 10);
    const preview = r.message.slice(0, 120) + (r.message.length > 120 ? '…' : '');

    if (r.type === 'approved') {
      const scoreStr = r.criticScore ? ` (score ${r.criticScore.score}/10)` : '';
      lines.push(`✓ APPROVED [${date}]${scoreStr}: "${preview}"`);
      if (r.criticScore?.strengths?.length) {
        lines.push(`  Strengths: ${r.criticScore.strengths.slice(0, 2).join(' | ')}`);
      }
    } else if (r.type === 'rejected') {
      const scoreStr = r.criticScore ? ` (score ${r.criticScore.score}/10)` : '';
      lines.push(`✗ REJECTED [${date}]${scoreStr}: "${preview}"`);
      if (r.criticScore?.improvements?.length) {
        lines.push(`  Weaknesses: ${r.criticScore.improvements.slice(0, 2).join(' | ')}`);
      }
    } else if (r.type === 'user_refinement' && r.userFeedback) {
      lines.push(`💬 USER FEEDBACK [${date}]: "${r.userFeedback}"`);
    }
  }

  lines.push('--- END PAST FEEDBACK ---');
  return lines.join('\n');
}
