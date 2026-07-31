export type Urgency = "low" | "medium" | "high" | "emergency" | string;

export interface User {
  id?: string;
  name: string;
  email: string;
  age?: number | null;
  gender?: string | null;
  blood_group?: string | null;
  allergies?: string | null;
  medical_history?: string | null;
  chronic_diseases?: string | null;
  emergency_contact?: string | null;
}

export interface PossibleCondition {
  name: string;
  confidence?: number | null;
  description?: string | null;
}

export interface HealthAnalysis {
  possible_conditions?: PossibleCondition[];
  urgency?: Urgency;
  recommendation?: string;
  follow_up_questions?: string[];
  disclaimer?: string;
  emergency?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  analysis?: HealthAnalysis;
}

export interface Conversation {
  id: string;
  title: string;
  preview?: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatResponse extends HealthAnalysis {
  conversation_id?: string;
  response: string;
}

export interface ImageAnalysis extends HealthAnalysis {
  conversation_id?: string;
  response: string;
  description?: string;
  visible_abnormalities?: string[];
  severity?: string;
  advice?: string;
}

export interface VoiceResponse extends ChatResponse {
  transcript?: string;
  audio_url?: string;
}

export interface Hospital {
  id?: string;
  name: string;
  type?: string;
  distance?: number | string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  is_open?: boolean;
}

export interface ApiErrorShape {
  detail?: string;
  message?: string;
}
