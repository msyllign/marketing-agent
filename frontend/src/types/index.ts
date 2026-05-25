export interface Persona {
  name: string;
  [key: string]: string | number;
}

export interface CriticScore {
  score: number;                  // 1–10  overall message quality
  complianceScore: number;        // 1–10  compliance with AI Training Pack
  approvalProbability: number;    // 0–100 estimated % chance compliance unit approves
  strengths: string[];
  complianceViolations: string[]; // specific guideline violations
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
