import * as fs from 'fs';
import * as path from 'path';
import type { Campaign, GeneratedMessage } from '../types';

const CAMPAIGNS_DIR = path.join(__dirname, '../../approved_messages');

function getCampaignPath(campaignId: string): string {
  return path.join(CAMPAIGNS_DIR, `${campaignId}.json`);
}

function ensureDir(): void {
  if (!fs.existsSync(CAMPAIGNS_DIR)) fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function saveCampaign(campaign: Campaign): void {
  ensureDir();
  fs.writeFileSync(getCampaignPath(campaign.id), JSON.stringify(campaign, null, 2));
}

export function loadCampaign(campaignId: string): Campaign | null {
  const filePath = getCampaignPath(campaignId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Campaign;
}

export function approveMessage(
  campaignId: string,
  personaName: string,
  message: string
): Campaign | null {
  const campaign = loadCampaign(campaignId);
  if (!campaign) return null;

  campaign.messages = campaign.messages.map((msg) =>
    msg.personaName === personaName && msg.message === message
      ? { ...msg, approved: true }
      : msg
  );

  saveCampaign(campaign);
  return campaign;
}

export function exportApprovedMessages(campaignId: string): Campaign['messages'] {
  const campaign = loadCampaign(campaignId);
  if (!campaign) return [];
  return campaign.messages.filter((m) => m.approved);
}

// ── Campaign cache lookup by file-content key ─────────────────────────────────
//
// Scans all stored campaigns for one whose cacheKey matches.
// Returns ALL messages (not just approved) from the most-recent matching campaign.
// The frontend will highlight which ones are already approved.

export function findMessagesByCacheKey(cacheKey: string): GeneratedMessage[] {
  ensureDir();
  let best: Campaign | null = null;

  try {
    const files = fs.readdirSync(CAMPAIGNS_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(CAMPAIGNS_DIR, file), 'utf-8');
        const c = JSON.parse(raw) as Campaign;
        if (c.cacheKey !== cacheKey) continue;
        // Take the most recently created matching campaign
        if (!best || c.createdAt > best.createdAt) best = c;
      } catch {
        // skip corrupt files
      }
    }
  } catch {
    // directory unreadable
  }

  if (!best) return [];

  const approved = best.messages.filter((m) => m.approved);
  console.log(
    `[MessageService] Cache hit for key "${cacheKey}": ` +
    `${approved.length}/${best.messages.length} approved messages from campaign ${best.id}`
  );
  return approved;
}
