from pathlib import Path
ROOT = Path(r"c:\Users\Spandan\Documents\GitHub\MediAssist")

# --- types ---
(ROOT / "frontend/src/types/index.ts").write_text('''export type Urgency = "low" | "medium" | "high" | "emergency" | string;

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
''', encoding="utf-8")
print("OK types")

# --- api.ts patches via full rewrite of key sections using read+replace ---
api = ROOT / "frontend/src/lib/api.ts"
atext = api.read_text(encoding="utf-8")

# Update normalizeChat
old_norm = '''function normalizeChat(raw: Record<string, unknown>): ChatResponse {
  const analysis = (raw.analysis || raw) as Record<string, unknown>;
  return {
    conversation_id: String(raw.conversation_id || raw.conversationId || "") || undefined,
    response: String(raw.response || raw.message || raw.answer || "I'm here to help you think through your symptoms."),
    possible_conditions: normalizeConditions(analysis.possible_conditions || analysis.conditions),
    urgency: String(analysis.urgency || analysis.urgency_level || "low"),
    recommendation: typeof analysis.recommendation === "string" ? analysis.recommendation : undefined,
    follow_up_questions: Array.isArray(analysis.follow_up_questions)
      ? analysis.follow_up_questions.filter((item): item is string => typeof item === "string")
      : [],
    disclaimer: typeof analysis.disclaimer === "string" ? analysis.disclaimer : undefined,
    emergency: Boolean(analysis.emergency || analysis.is_emergency),
  };
}'''

# The apostrophe in I'm might differ - let's find and replace more carefully
import re
m = re.search(r"function normalizeChat\(raw: Record<string, unknown>\): ChatResponse \{.*?\n\}", atext, re.S)
if not m:
    raise SystemExit("normalizeChat not found")
new_norm = '''function normalizeChat(raw: Record<string, unknown>): ChatResponse {
  const analysis = (raw.analysis || raw) as Record<string, unknown>;
  const crisis = Array.isArray(analysis.crisis_resources)
    ? analysis.crisis_resources
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          label: String(item.label || "Help resource"),
          detail: String(item.detail || ""),
          phone: typeof item.phone === "string" ? item.phone : undefined,
          url: typeof item.url === "string" ? item.url : undefined,
        }))
    : [];
  const hospitals = Array.isArray(analysis.nearest_hospitals)
    ? analysis.nearest_hospitals
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          id: String(item.id || ""),
          name: String(item.name || "Nearby facility"),
          type: typeof item.type === "string" ? item.type : undefined,
          distance_km: typeof item.distance_km === "number" ? item.distance_km : undefined,
          address: typeof item.address === "string" ? item.address : undefined,
          phone: typeof item.phone === "string" ? item.phone : undefined,
          latitude: typeof item.latitude === "number" ? item.latitude : undefined,
          longitude: typeof item.longitude === "number" ? item.longitude : undefined,
          maps_url: typeof item.maps_url === "string" ? item.maps_url : undefined,
        }))
    : [];
  return {
    conversation_id: String(raw.conversation_id || raw.conversationId || "") || undefined,
    response: String(raw.response || raw.message || raw.answer || "I'm here to help you think through your symptoms."),
    possible_conditions: normalizeConditions(analysis.possible_conditions || analysis.conditions),
    urgency: String(analysis.urgency || analysis.urgency_level || "low"),
    recommendation: typeof analysis.recommendation === "string" ? analysis.recommendation : undefined,
    follow_up_questions: Array.isArray(analysis.follow_up_questions)
      ? analysis.follow_up_questions.filter((item): item is string => typeof item === "string")
      : [],
    disclaimer: typeof analysis.disclaimer === "string" ? analysis.disclaimer : undefined,
    emergency: Boolean(analysis.emergency || analysis.is_emergency),
    emergency_category: typeof analysis.emergency_category === "string" ? analysis.emergency_category : undefined,
    crisis_resources: crisis,
    nearest_hospitals: hospitals,
  };
}'''
atext = atext[:m.start()] + new_norm + atext[m.end():]

# Update chatApi.send
old_send = '''export const chatApi = {
  async send(payload: { message: string; conversation_id?: string }) {
    const response = await api.post<Record<string, unknown>>("/api/chat", payload);
    return normalizeChat(unwrap(response.data) as Record<string, unknown>);
  },
};'''
new_send = '''export const chatApi = {
  async send(payload: {
    message: string;
    conversation_id?: string;
    context?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const response = await api.post<Record<string, unknown>>("/api/chat", payload);
    return normalizeChat(unwrap(response.data) as Record<string, unknown>);
  },
};'''
if old_send not in atext:
    raise SystemExit("chatApi.send not found")
atext = atext.replace(old_send, new_send)

# Update assessmentApi
old_assess = '''export const assessmentApi = {
  async run(payload: {
    smoking: string;
    alcohol: string;
    exercise: string;
    diet: string;
    sleep: string;
    stress: string;
  }) {
    const response = await api.post<Record<string, unknown>>("/api/assessment", payload);
    const raw = unwrap(response.data) as Record<string, unknown>;
    return {
      risk_score: Number(raw.risk_score ?? 0),
      risk_level: String(raw.risk_level || "moderate"),
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.filter((item): item is string => typeof item === "string") : [],
      preventive_tips: Array.isArray(raw.preventive_tips)
        ? raw.preventive_tips.filter((item): item is string => typeof item === "string")
        : [],
      disclaimer: typeof raw.disclaimer === "string" ? raw.disclaimer : undefined,
    };
  },
};'''
new_assess = '''function normalizeAssessment(raw: Record<string, unknown>) {
  return {
    id: raw.id ? String(raw.id) : undefined,
    risk_score: Number(raw.risk_score ?? 0),
    risk_level: String(raw.risk_level || "moderate"),
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.filter((item): item is string => typeof item === "string") : [],
    preventive_tips: Array.isArray(raw.preventive_tips)
      ? raw.preventive_tips.filter((item): item is string => typeof item === "string")
      : [],
    disclaimer: typeof raw.disclaimer === "string" ? raw.disclaimer : undefined,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    chat_prompts: Array.isArray(raw.chat_prompts)
      ? raw.chat_prompts.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export const assessmentApi = {
  async run(payload: {
    smoking: string;
    alcohol: string;
    exercise: string;
    diet: string;
    sleep: string;
    stress: string;
  }) {
    const response = await api.post<Record<string, unknown>>("/api/assessment", payload);
    return normalizeAssessment(unwrap(response.data) as Record<string, unknown>);
  },
  async history() {
    const response = await api.get<unknown>("/api/assessment/history");
    const raw = unwrap(response.data) as unknown;
    const list = Array.isArray(raw) ? raw : [];
    return list
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map(normalizeAssessment);
  },
};'''
if old_assess not in atext:
    raise SystemExit("assessmentApi not found")
atext = atext.replace(old_assess, new_assess)

api.write_text(atext, encoding="utf-8")
print("OK api.ts")
