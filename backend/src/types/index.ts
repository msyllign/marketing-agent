export interface Persona {
  name: string;
  generalDescription?: string;
  milestones?: string;
  needs?: string;
  communication?: string;
  [key: string]: string | number | undefined;
}

export interface CampaignBrief {
  title?: string;
  product?: string;
  primaryMessage?: string;
  secondaryMessage?: string;
  crossSell?: string;
  customerJourney?: string;
  additionalInfo?: string;
}

export interface AITrainingPack {
  purpose?: string;
  roleDefinition?: string;
  languageGuidelines?: string;
  segmentDifferentiation?: string;
  [key: string]: string | undefined;
}

export interface ProductDescription {
  [productName: string]: {
    description?: string;
    [key: string]: string | undefined;
  };
}

export interface CampaignData {
  brief: CampaignBrief;
  personas: Persona[];
  aiTrainingPack: AITrainingPack;
  products: ProductDescription;
  smsTemplate: string;
}

// ── Critic / Feedback types ──────────────────────────────────────────────────

export interface CriticScore {
  score: number;        // 1–10
  strengths: string[];
  improvements: string[];
}

export type FeedbackRecordType = 'approved' | 'rejected' | 'user_refinement';

export interface FeedbackRecord {
  personaName: string;
  campaignId: string;
  timestamp: string;
  type: FeedbackRecordType;
  message: string;
  criticScore?: CriticScore;
  userFeedback?: string;   // populated for user_refinement records
}

export interface FeedbackStore {
  [personaName: string]: FeedbackRecord[];
}

// ── Generated message (extended with critic metadata) ────────────────────────

export interface GeneratedMessage {
  personaName: string;
  persona: Persona;
  message: string;
  approved: boolean;
  criticScore?: CriticScore;
  refinementIterations?: number;
}

export interface Campaign {
  id: string;
  smsTemplate: string;
  personas: Persona[];
  brief: CampaignBrief;
  aiTrainingPack: AITrainingPack;
  products: ProductDescription;
  messages: GeneratedMessage[];
  createdAt: string;
}
