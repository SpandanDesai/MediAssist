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
  current_medications?: string | null;
  emergency_contact?: string | null;
  allergy_list?: string[];
  medication_list?: string[];
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string | null;
  due_at?: string | null;
  done: boolean;
  created_at: string;
}

export interface RiskTrendPoint {
  created_at: string;
  risk_score: number;
  risk_level: string;
}

export interface HighRiskConversation {
  id: string;
  title: string;
  urgency: string;
  updated_at: string;
}

export interface HealthStats {
  counts: Record<string, number>;
  conversations_by_modality: Record<string, number>;
  urgency_distribution: Record<string, number>;
  assessment_trend: RiskTrendPoint[];
  recent_high_risk?: HighRiskConversation[];
  window: number;
}

export interface PossibleCondition {
  name: string;
  confidence?: number | null;
  description?: string | null;
}

export interface CrisisResource {
  label: string;
  detail: string;
  phone?: string | null;
  url?: string | null;
}

export interface NearbyFacility {
  id: string;
  name: string;
  type?: string | null;
  distance_km?: number | null;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
}

export interface HealthAnalysis {
  possible_conditions?: PossibleCondition[];
  urgency?: Urgency;
  recommendation?: string;
  follow_up_questions?: string[];
  disclaimer?: string;
  emergency?: boolean;
  emergency_category?: string;
  crisis_resources?: CrisisResource[];
  nearest_hospitals?: NearbyFacility[];
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
  modality?: string | null;
  tags?: string[];
  archived?: boolean;
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

export interface AssessmentResult {
  id?: string;
  risk_score: number;
  risk_level: string;
  suggestions: string[];
  preventive_tips: string[];
  disclaimer?: string;
  created_at?: string;
  chat_prompts?: string[];
}

export interface ApiErrorShape {
  detail?: string;
  message?: string;
}


export interface ObesityLifestyleInput {
  Gender: "Female" | "Male";
  Age: number;
  family_history_with_overweight: "yes" | "no";
  FAVC: "yes" | "no";
  FCVC: number;
  NCP: number;
  CAEC: "no" | "Sometimes" | "Frequently" | "Always";
  SMOKE: "yes" | "no";
  CH2O: number;
  SCC: "yes" | "no";
  FAF: number;
  TUE: number;
  CALC: "no" | "Sometimes" | "Frequently" | "Always";
  MTRANS: "Automobile" | "Motorbike" | "Bike" | "Public_Transportation" | "Walking";
}

export interface ObesityAllFeaturesInput extends ObesityLifestyleInput {
  Height: number;
  Weight: number;
}

export interface ObesityPredictionResult {
  predicted_category: string;
  category_label: string;
  model: string;
  class_probabilities?: Record<string, number>;
  disclaimer: string;
  recommendations: string[];
}
