export interface Persona {
  name: string;
  [key: string]: string | number;
}

export interface GeneratedMessage {
  personaName: string;
  persona: Persona;
  message: string;
  approved: boolean;
}

export interface Campaign {
  campaignId: string;
  smsTemplateFile: string;
  personasFile: string;
  messages: GeneratedMessage[];
  approvedMessages: GeneratedMessage[];
}
