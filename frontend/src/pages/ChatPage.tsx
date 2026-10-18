import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Search, Send, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmergencyAlert } from "../components/EmergencyAlert";
import { HealthAnalysisCard } from "../components/HealthAnalysisCard";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { MedicationNotice } from "../components/MedicationNotice";
import { TypingIndicator } from "../components/TypingIndicator";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/form";
import { Skeleton } from "../components/ui/skeleton";
import { useGeolocation } from "../hooks/useGeolocation";
import { chatApi, historyApi, medicationApi, reportApi, apiErrorMessage } from "../lib/api";
import { displayDate, isEmergencyText } from "../lib/utils";
import type { ChatMessage, Conversation, CrisisResource, HealthAnalysis, NearbyFacility } from "../types";

const STARTER_PROMPTS = [
  "I have had fever and sore throat for two days",
  "I have a headache that started this morning",
  "I noticed a rash on my arm",
  "I have stomach pain and nausea",
];

export function ChatPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { latitude, longitude, locate } = useGeolocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(searchParams.get("conversation") || undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(searchParams.get("prompt") || "");
  const [query, setQuery] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [medicationNotice, setMedicationNotice] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyMeta, setEmergencyMeta] = useState<{
    category?: string;
    crisisResources?: CrisisResource[];
    nearestHospitals?: NearbyFacility[];
  }>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const locatedOnce = useRef(false);
  const activeIdRef = useRef<string | undefined>(searchParams.get("conversation") || undefined);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [oldestSeq, setOldestSeq] = useState<number | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  async function refreshHistory() {
    const items = await historyApi.list();
    setConversations(items);
    return items;
  }

  async function loadMessages(id?: string) {
    if (!id) {
      setMessages([]);
      setHasMoreOlder(false);
      setOldestSeq(undefined);
      return;
    }
    try {
      const page = await historyApi.messagesPage(id);
      if (activeIdRef.current === id) {
        setMessages(page.messages);
        setHasMoreOlder(page.hasMore);
        setOldestSeq(page.oldestSeq);
      }
    } catch {
      if (activeIdRef.current === id) {
        setMessages([]);
        setHasMoreOlder(false);
        setOldestSeq(undefined);
      }
    }
  }

  async function loadOlder() {
    const id = activeIdRef.current;
    if (!id || oldestSeq === undefined || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await historyApi.messagesPage(id, oldestSeq);
      if (activeIdRef.current === id) {
        const seen = new Set(messages.map((m) => m.id));
        const fresh = page.messages.filter((m) => !seen.has(m.id));
        setMessages((current) => [...fresh, ...current]);
        setHasMoreOlder(page.hasMore);
        if (page.oldestSeq !== undefined) setOldestSeq(page.oldestSeq);
      }
    } catch {
      // Leave the current window intact if the older page fails to load.
    } finally {
      setLoadingOlder(false);
    }
  }

  async function runMedicationReview() {
    const text = draft.trim() || [...messages].reverse().find((m) => m.role === "user")?.content || "";
    if (!text || reviewing) return;
    setReviewing(true);
    try {
      const result = await medicationApi.review(text.slice(0, 2000));
      if (!result) {
        showToast({ tone: "info", title: "No profile conflicts found", message: "Nothing in your listed allergies or medications matches that." });
        return;
      }
      const analysis: HealthAnalysis = {
        possible_conditions: result.possible_conditions,
        urgency: result.urgency,
        recommendation: result.recommendation,
        follow_up_questions: result.follow_up_questions,
        disclaimer: result.disclaimer,
        emergency: result.emergency,
        emergency_category: result.emergency_category,
        crisis_resources: result.crisis_resources,
        nearest_hospitals: result.nearest_hospitals,
      };
      setMessages((current) => [
        ...current,
        { id: `review-${Date.now()}`, role: "assistant", content: result.response, created_at: new Date().toISOString(), analysis },
      ]);
      if (result.emergency) {
        setEmergencyMeta({ category: result.emergency_category, crisisResources: result.crisis_resources, nearestHospitals: result.nearest_hospitals });
        setEmergencyOpen(true);
      }
    } catch (error) {
      showToast({ tone: "error", title: "Profile check failed", message: apiErrorMessage(error) });
    } finally {
      setReviewing(false);
    }
  }

  useEffect(() => {
    if (!locatedOnce.current) {
      locatedOnce.current = true;
      locate();
    }
  }, [locate]);

  useEffect(() => {
    let live = true;
    refreshHistory()
      .then((items) => {
        if (!live) return;
        const requested = searchParams.get("conversation") || undefined;
        const selected = items.find((item) => item.id === requested) || (requested ? undefined : items[0]);
        if (selected) {
          activeIdRef.current = selected.id;
          setActiveId(selected.id);
          void loadMessages(selected.id);
        } else if (searchParams.get("prompt")) {
          setActiveId(undefined);
          setMessages([]);
        }
      })
      .catch(() => { if (live) setConversations([]); })
      .finally(() => { if (live) setLoadingHistory(false); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    const text = draft.trim();
    if (!text) {
      setMedicationNotice(false);
      return;
    }
    const timer = window.setTimeout(() => {
      medicationApi
        .requiresProfessionalGuidance(text.slice(0, 2000))
        .then(setMedicationNotice)
        .catch(() => setMedicationNotice(false));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((item) => item.title.toLowerCase().includes(needle) || (item.preview || "").toLowerCase().includes(needle));
  }, [conversations, query]);

  function selectConversation(conversation: Conversation) {
    activeIdRef.current = conversation.id;
    setActiveId(conversation.id);
    setMessages([]);
    setSearchParams(conversation.id ? { conversation: conversation.id } : {});
    void loadMessages(conversation.id);
  }

  function startNew() {
    activeIdRef.current = undefined;
    setActiveId(undefined);
    setMessages([]);
    setSearchParams({});
  }

  async function removeConversation(id: string) {
    try {
      await historyApi.remove(id);
      const next = conversations.filter((item) => item.id !== id);
      setConversations(next);
      if (activeId === id) {
        if (next[0]) selectConversation(next[0]);
        else startNew();
      }
      showToast({ tone: "success", title: "Conversation deleted" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not delete conversation", message: apiErrorMessage(error) });
    }
  }

  async function downloadReport() {
    if (!activeId) {
      showToast({ tone: "info", title: "Start a conversation first" });
      return;
    }
    try {
      const response = await reportApi.generate(activeId);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mediassist-report-${activeId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast({ tone: "success", title: "Report downloaded" });
    } catch (error) {
      showToast({ tone: "error", title: "Report failed", message: apiErrorMessage(error) });
    }
  }

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    if (isEmergencyText(trimmed)) setEmergencyOpen(true);

    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", content: trimmed, created_at: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setSending(true);
    try {
      const result = await chatApi.send({ message: trimmed, conversation_id: activeId, latitude: latitude ?? undefined, longitude: longitude ?? undefined });
      const analysis: HealthAnalysis = {
        possible_conditions: result.possible_conditions,
        urgency: result.urgency,
        recommendation: result.recommendation,
        follow_up_questions: result.follow_up_questions,
        disclaimer: result.disclaimer,
        emergency: result.emergency,
        emergency_category: result.emergency_category,
        crisis_resources: result.crisis_resources,
        nearest_hospitals: result.nearest_hospitals,
      };
      if (result.emergency) {
        setEmergencyMeta({ category: result.emergency_category, crisisResources: result.crisis_resources, nearestHospitals: result.nearest_hospitals });
        setEmergencyOpen(true);
      }
      const assistant: ChatMessage = { id: `assistant-${Date.now()}`, role: "assistant", content: result.response, created_at: new Date().toISOString(), analysis };
      setMessages((current) => [...current, assistant]);
      if (result.conversation_id) {
        activeIdRef.current = result.conversation_id;
        setActiveId(result.conversation_id);
        setSearchParams({ conversation: result.conversation_id });
      }
      await refreshHistory().catch(() => undefined);
    } catch (error) {
      setDraft(trimmed);
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      showToast({ tone: "error", title: "Consultation failed", message: apiErrorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await sendMessage(draft);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      {emergencyOpen && (
        <EmergencyAlert
          onClose={() => setEmergencyOpen(false)}
          category={emergencyMeta.category}
          crisisResources={emergencyMeta.crisisResources}
          nearestHospitals={emergencyMeta.nearestHospitals}
        />
      )}
      <Card className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden">
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Conversations</p>
            <p className="mt-1 text-xs text-ink-2">Search or continue a prior chat</p>
          </div>
          <Button size="sm" variant="outline" onClick={startNew}>New consultation</Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <div>
            <Label htmlFor="chat-search" className="mb-1">Search conversations</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
              <Input id="chat-search" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Try "sore throat"' />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {loadingHistory ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)
            ) : filtered.length ? (
              filtered.map((conversation) => (
                <div key={conversation.id} className={`flex items-start gap-1 rounded-lg p-1 ${activeId === conversation.id ? "bg-brand-tint" : ""}`}>
                  <button onClick={() => selectConversation(conversation)} className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left hover:bg-surface-alt">
                    <span className={`block truncate text-sm font-semibold ${activeId === conversation.id ? "text-brand" : "text-ink"}`}>{conversation.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-2">{displayDate(conversation.updated_at)}</span>
                  </button>
                  <button
                    onClick={() => removeConversation(conversation.id)}
                    className="mt-1.5 rounded-lg p-2 text-ink-2 transition-colors hover:bg-danger-tint hover:text-danger"
                    aria-label={`Delete conversation ${conversation.title}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <p className="px-2 py-8 text-center text-xs text-ink-2">No conversations yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex h-[calc(100vh-8.5rem)] flex-col overflow-hidden">
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">AI consultation</p>
            <p className="mt-1 text-xs text-ink-2">Educational guidance with confidence where available — never a confirmed diagnosis.</p>
          </div>
          <Button size="sm" variant="outline" onClick={downloadReport} disabled={!activeId}>
            <FileDown className="h-4 w-4" aria-hidden="true" />Download summary (PDF)
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-xl bg-canvas p-4" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation messages">
            {hasMoreOlder && (
              <div className="flex justify-center pb-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => void loadOlder()} disabled={loadingOlder}>{loadingOlder ? "Loading…" : "Load older messages"}</Button>
              </div>
            )}
            {messages.length === 0 && !sending && (
              <div className="mx-auto max-w-lg py-10 text-center">
                <p className="text-sm font-bold text-ink">Describe what you are experiencing</p>
                <p className="mt-2 text-xs leading-5 text-ink-2">Or tap a starter to begin a guided consultation.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} className="rounded-full border border-rule bg-surface px-3 py-2 text-left text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl rounded-br-sm bg-brand-tint px-4 py-3 text-sm leading-6 text-ink font-read">{message.content}</div>
                </div>
              ) : (
                <div key={message.id} className="max-w-[68ch]">
                  <MarkdownMessage>{message.content}</MarkdownMessage>
                  <HealthAnalysisCard analysis={message.analysis} onFollowUp={(question) => void sendMessage(question)} />
                </div>
              ),
            )}
            {sending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
          {medicationNotice && <MedicationNotice onReview={runMedicationReview} reviewing={reviewing} />}
          <form onSubmit={submit}>
            <Label htmlFor="chat-composer">Describe your symptoms</Label>
            <div className="flex items-end gap-3">
              <Textarea
                id="chat-composer"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="e.g. Fever of 38.5°C since last night, sore throat, no cough…"
                className="min-h-[56px] flex-1"
                maxLength={8000}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit(event as unknown as FormEvent);
                  }
                }}
              />
              <Button type="submit" disabled={sending || !draft.trim()} aria-label="Send message"><Send className="h-4 w-4" aria-hidden="true" />Send</Button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-2">Enter to send · Shift+Enter for a new line · MediAssist never provides dosing advice.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
