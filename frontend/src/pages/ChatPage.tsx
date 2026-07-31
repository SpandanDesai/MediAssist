import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, Search, Send, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { EmergencyAlert } from "../components/EmergencyAlert";
import { HealthAnalysisCard } from "../components/HealthAnalysisCard";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { TypingIndicator } from "../components/TypingIndicator";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/form";
import { Skeleton } from "../components/ui/skeleton";
import { chatApi, historyApi, reportApi, apiErrorMessage } from "../lib/api";
import { displayDate, isEmergencyText } from "../lib/utils";
import type { ChatMessage, Conversation, HealthAnalysis } from "../types";

export function ChatPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(searchParams.get("conversation") || undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function refreshHistory() {
    const items = await historyApi.list();
    setConversations(items);
    return items;
  }

  useEffect(() => {
    let live = true;
    refreshHistory()
      .then((items) => {
        if (!live) return;
        const requested = searchParams.get("conversation") || undefined;
        const selected = items.find((item) => item.id === requested) || items[0];
        if (selected) {
          setActiveId(selected.id);
          setMessages(selected.messages || []);
        }
      })
      .catch(() => {
        if (live) setConversations([]);
      })
      .finally(() => {
        if (live) setLoadingHistory(false);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (item) => item.title.toLowerCase().includes(needle) || (item.preview || "").toLowerCase().includes(needle),
    );
  }, [conversations, query]);

  function selectConversation(conversation: Conversation) {
    setActiveId(conversation.id);
    setMessages(conversation.messages || []);
    setSearchParams(conversation.id ? { conversation: conversation.id } : {});
  }

  async function startNew() {
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    if (isEmergencyText(message)) setEmergencyOpen(true);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setSending(true);
    try {
      const result = await chatApi.send({ message, conversation_id: activeId });
      const analysis: HealthAnalysis = {
        possible_conditions: result.possible_conditions,
        urgency: result.urgency,
        recommendation: result.recommendation,
        follow_up_questions: result.follow_up_questions,
        disclaimer: result.disclaimer,
        emergency: result.emergency,
      };
      if (result.emergency) setEmergencyOpen(true);
      const assistant: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.response,
        created_at: new Date().toISOString(),
        analysis,
      };
      setMessages((current) => [...current, assistant]);
      if (result.conversation_id) {
        setActiveId(result.conversation_id);
        setSearchParams({ conversation: result.conversation_id });
      }
      await refreshHistory().catch(() => undefined);
    } catch (error) {
      showToast({ tone: "error", title: "Consultation failed", message: apiErrorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      {emergencyOpen && <EmergencyAlert onClose={() => setEmergencyOpen(false)} />}
      <Card className="h-[calc(100vh-9.5rem)] overflow-hidden">
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Conversations</p>
            <p className="mt-1 text-xs text-slate-500">Search or continue a prior chat</p>
          </div>
          <Button size="sm" variant="outline" onClick={startNew}>New</Button>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-4.5rem)] flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search history" />
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {loadingHistory ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14" />)
            ) : filtered.length ? (
              filtered.map((conversation) => (
                <div key={conversation.id} className={`group flex items-start gap-1 rounded-xl p-1 ${activeId === conversation.id ? "bg-sky-50 dark:bg-sky-950/30" : ""}`}>
                  <button onClick={() => selectConversation(conversation)} className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span className="block truncate text-sm font-semibold">{conversation.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">{displayDate(conversation.updated_at)}</span>
                  </button>
                  <button onClick={() => removeConversation(conversation.id)} className="rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100" aria-label="Delete conversation">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <p className="px-2 py-8 text-center text-xs text-slate-500">No conversations yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex h-[calc(100vh-9.5rem)] flex-col overflow-hidden">
        <CardHeader>
          <div>
            <p className="text-sm font-bold">AI consultation</p>
            <p className="mt-1 text-xs text-slate-500">Educational guidance with confidence estimates — never a confirmed diagnosis.</p>
          </div>
          <Button size="sm" variant="outline" onClick={downloadReport} disabled={!activeId}><FileDown className="h-4 w-4" />PDF</Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-950/40">
            {messages.length === 0 && !sending && (
              <div className="mx-auto max-w-lg py-16 text-center">
                <p className="text-sm font-bold">Describe what you are experiencing</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Example: “I have had fever and sore throat for two days.”</p>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${message.role === "user" ? "rounded-tr-sm bg-sky-500 text-white" : "rounded-tl-sm bg-white shadow-sm dark:bg-slate-900"}`}>
                  {message.role === "assistant" ? <MarkdownMessage>{message.content}</MarkdownMessage> : <p className="text-sm leading-6">{message.content}</p>}
                  {message.role === "assistant" && <HealthAnalysisCard analysis={message.analysis} />}
                </div>
              </div>
            ))}
            {sending && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={submit} className="flex gap-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Share your symptoms…"
              className="min-h-[56px] flex-1"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit(event as unknown as FormEvent);
                }
              }}
            />
            <Button type="submit" disabled={sending || !draft.trim()} className="self-end"><Send className="h-4 w-4" /></Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
