import * as fs from 'fs';
import * as path from 'path';
import type { Campaign } from '../types';

const CAMPAIGNS_DIR = path.join(__dirname, '../../approved_messages');

function getCampaignPath(campaignId: string): string {
  return path.join(CAMPAIGNS_DIR, `${campaignId}.json`);
}

export function saveCampaign(campaign: Campaign): void {
  if (!fs.existsSync(CAMPAIGNS_DIR)) {
    fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });
  }
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
