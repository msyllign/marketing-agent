export interface Persona {
  name: string;
  [key: string]: string | number;
}

export interface CriticScore {
  score: number;        // 1–10
  strengths: string[];
  improvements: string[];
}

export interface GeneratedMessage {
  personaName: string;
  persona: Persona;
  message: string;
  approved: boolean;
  segment?: string;
  product?: string;
  criticScore?: CriticScore;
  refinementIterations?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type FeedbackRecordType = 'approved' | 'rejected' | 'user_refinement';

export interface FeedbackRecord {
  personaName: string;
  campaignId: string;
  timestamp: string;
  type: FeedbackRecordType;
  message: string;
  criticScore?: CriticScore;
  userFeedback?: string;
}
