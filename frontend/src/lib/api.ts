import axios, { type AxiosRequestConfig } from "axios";
import type {
  ChatResponse,
  Conversation,
  Hospital,
  ImageAnalysis,
  User,
  VoiceResponse,
} from "../types";

const baseURL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const TOKEN_KEY = "mediassist.access_token";

export const api = axios.create({
  baseURL,
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { detail?: string | { msg?: string }[]; message?: string } | undefined;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return body.detail.map((item) => item.msg).filter(Boolean).join(" ") || fallback;
    if (body?.message) return body.message;
    if (!error.response) return "Unable to reach MediAssist. Check that the API is running and try again.";
  }
  return fallback;
}

function unwrap<T>(value: T | { data?: T }) {
  if (value && typeof value === "object" && "data" in value) return (value as { data?: T }).data ?? value;
  return value as T;
}

async function postWithFallback<T>(paths: string[], body?: unknown, config?: AxiosRequestConfig) {
  let lastError: unknown;
  for (const path of paths) {
    try {
      const response = await api.post<T>(path, body, config);
      return response.data;
    } catch (error) {
      lastError = error;
      if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;
    }
  }
  throw lastError;
}

function normalizeUser(raw: Partial<User> & { username?: string; full_name?: string }): User {
  return {
    id: raw.id,
    name: raw.name || raw.full_name || raw.username || "MediAssist user",
    email: raw.email || "",
    age: raw.age ?? null,
    gender: raw.gender ?? null,
    blood_group: raw.blood_group ?? null,
    allergies: raw.allergies ?? null,
    medical_history: raw.medical_history ?? null,
    chronic_diseases: raw.chronic_diseases ?? null,
    emergency_contact: raw.emergency_contact ?? null,
  };
}

function normalizeConditions(raw: unknown): ChatResponse["possible_conditions"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { name: item };
    const condition = item as { name?: string; condition?: string; confidence?: number; probability?: number; description?: string };
    return {
      name: condition.name || condition.condition || "Possible condition",
      confidence: condition.confidence ?? condition.probability ?? null,
      description: condition.description,
    };
  });
}

function normalizeChat(raw: Record<string, unknown>): ChatResponse {
  const analysis = (raw.analysis || raw) as Record<string, unknown>;
  return {
    conversation_id: String(raw.conversation_id || raw.conversationId || "") || undefined,
    response: String(raw.response || raw.message || raw.answer || "I’m here to help you think through your symptoms."),
    possible_conditions: normalizeConditions(analysis.possible_conditions || analysis.conditions),
    urgency: String(analysis.urgency || analysis.urgency_level || "low"),
    recommendation: typeof analysis.recommendation === "string" ? analysis.recommendation : undefined,
    follow_up_questions: Array.isArray(analysis.follow_up_questions)
      ? analysis.follow_up_questions.filter((item): item is string => typeof item === "string")
      : [],
    disclaimer: typeof analysis.disclaimer === "string" ? analysis.disclaimer : undefined,
    emergency: Boolean(analysis.emergency || analysis.is_emergency),
  };
}

function normalizeConversation(raw: Record<string, unknown>): Conversation {
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map((message, index) => {
        const item = message as Record<string, unknown>;
        const role: "user" | "assistant" = item.role === "assistant" ? "assistant" : "user";
        return {
          id: String(item.id || index),
          role,
          content: String(item.content || item.message || ""),
          created_at: String(item.created_at || item.timestamp || new Date().toISOString()),
          analysis: item.analysis ? normalizeChat(item as Record<string, unknown>) : undefined,
        };
      })
    : undefined;
  return {
    id: String(raw.id || raw._id || raw.conversation_id || ""),
    title: String(raw.title || raw.subject || raw.preview || "Health consultation"),
    preview: typeof raw.preview === "string" ? raw.preview : undefined,
    updated_at: String(raw.updated_at || raw.created_at || raw.timestamp || new Date().toISOString()),
    messages,
  };
}

export const authApi = {
  async login(payload: { email: string; password: string }) {
    const raw = unwrap(await postWithFallback<Record<string, unknown>>(["/api/auth/login", "/api/login"], payload)) as Record<string, unknown>;
    const token = String(raw.access_token || raw.token || "");
    if (!token) throw new Error("The server did not return an access token.");
    const userSource = (raw.user || raw.profile || { email: payload.email }) as Partial<User>;
    return { token, user: normalizeUser(userSource) };
  },
  async signup(payload: { name: string; email: string; password: string; age?: number; gender?: string }) {
    const raw = unwrap(await postWithFallback<Record<string, unknown>>(["/api/auth/signup", "/api/signup"], payload)) as Record<string, unknown>;
    const token = String(raw.access_token || raw.token || "");
    if (!token) throw new Error("Your account was created, but no access token was returned. Please sign in.");
    const userSource = (raw.user || raw.profile || { name: payload.name, email: payload.email }) as Partial<User>;
    return { token, user: normalizeUser(userSource) };
  },
};

export const profileApi = {
  async get() {
    const response = await api.get<Partial<User> | { data?: Partial<User> }>("/api/profile");
    return normalizeUser(unwrap(response.data) as Partial<User>);
  },
  async update(payload: Partial<User>) {
    const response = await api.put<Partial<User> | { data?: Partial<User> }>("/api/profile", payload);
    return normalizeUser(unwrap(response.data) as Partial<User>);
  },
};

export const chatApi = {
  async send(payload: { message: string; conversation_id?: string }) {
    const response = await api.post<Record<string, unknown>>("/api/chat", payload);
    return normalizeChat(unwrap(response.data) as Record<string, unknown>);
  },
};

export const historyApi = {
  async list() {
    const response = await api.get<unknown>("/api/history");
    const raw = unwrap(response.data) as unknown;
    const list = Array.isArray(raw)
      ? raw
      : ((raw as { conversations?: unknown[]; items?: unknown[] })?.conversations || (raw as { items?: unknown[] })?.items || []);
    return list.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).map(normalizeConversation);
  },
  async remove(id: string) {
    await api.delete(`/api/history/${encodeURIComponent(id)}`);
  },
};

export const imageApi = {
  async analyze(file: File, notes?: string) {
    const form = new FormData();
    form.append("image", file);
    if (notes) form.append("notes", notes);
    const response = await api.post<Record<string, unknown>>("/api/image", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const raw = unwrap(response.data) as Record<string, unknown>;
    const normalized = normalizeChat(raw);
    return {
      ...normalized,
      description: typeof raw.description === "string" ? raw.description : undefined,
      visible_abnormalities: Array.isArray(raw.visible_abnormalities)
        ? raw.visible_abnormalities.filter((item): item is string => typeof item === "string")
        : [],
      severity: typeof raw.severity === "string" ? raw.severity : undefined,
      advice: typeof raw.advice === "string" ? raw.advice : normalized.recommendation,
    } as ImageAnalysis;
  },
};

export const voiceApi = {
  async analyze(audio: Blob, conversation_id?: string) {
    const form = new FormData();
    form.append("audio", audio, "consultation.webm");
    if (conversation_id) form.append("conversation_id", conversation_id);
    const response = await api.post<Record<string, unknown>>("/api/voice", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const raw = unwrap(response.data) as Record<string, unknown>;
    return {
      ...normalizeChat(raw),
      transcript: typeof raw.transcript === "string" ? raw.transcript : undefined,
      audio_url: typeof raw.audio_url === "string" ? raw.audio_url : undefined,
    } as VoiceResponse;
  },
};

export const hospitalApi = {
  async nearby(latitude: number, longitude: number) {
    const response = await api.get<unknown>("/api/hospitals", { params: { lat: latitude, lng: longitude } });
    const raw = unwrap(response.data) as unknown;
    const list = Array.isArray(raw) ? raw : (raw as { hospitals?: unknown[] })?.hospitals || [];
    return list.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).map((item) => ({
      id: item.id ? String(item.id) : undefined,
      name: String(item.name || "Nearby healthcare facility"),
      type: typeof item.type === "string" ? item.type : typeof item.category === "string" ? item.category : undefined,
      distance: typeof item.distance === "number" || typeof item.distance === "string" ? item.distance : undefined,
      address: typeof item.address === "string" ? item.address : undefined,
      phone: typeof item.phone === "string" ? item.phone : undefined,
      latitude: Number(item.latitude ?? item.lat) || undefined,
      longitude: Number(item.longitude ?? item.lng) || undefined,
      is_open: typeof item.is_open === "boolean" ? item.is_open : undefined,
    })) as Hospital[];
  },
};

export const reportApi = {
  async generate(conversation_id?: string) {
    return api.post("/api/reports", { conversation_id }, { responseType: "blob" });
  },
  async list() {
    const response = await api.get<unknown>("/api/reports");
    const raw = unwrap(response.data) as unknown;
    const list = Array.isArray(raw) ? raw : (raw as { reports?: unknown[] })?.reports || [];
    return list
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => ({
        id: String(item.id || item._id || ""),
        title: String(item.title || "Medical report"),
        created_at: String(item.created_at || new Date().toISOString()),
        conversation_id: item.conversation_id ? String(item.conversation_id) : undefined,
      }));
  },
  async download(id: string) {
    return api.get(`/api/reports/${encodeURIComponent(id)}/download`, { responseType: "blob" });
  },
};

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
};

export { TOKEN_KEY, baseURL };
