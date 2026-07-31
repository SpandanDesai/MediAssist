import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { EmergencyAlert } from "../components/EmergencyAlert";
import { HealthAnalysisCard } from "../components/HealthAnalysisCard";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { TypingIndicator } from "../components/TypingIndicator";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { apiErrorMessage, voiceApi } from "../lib/api";
import { isEmergencyText } from "../lib/utils";
import type { ChatMessage } from "../types";

export function VoicePage() {
  const { showToast } = useToast();
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setPending(true);
        try {
          const result = await voiceApi.analyze(blob, conversationId);
          if (result.transcript && isEmergencyText(result.transcript)) setEmergencyOpen(true);
          if (result.emergency) setEmergencyOpen(true);
          const now = new Date().toISOString();
          setMessages((current) => [
            ...current,
            { id: `u-${Date.now()}`, role: "user", content: result.transcript || "Voice message", created_at: now },
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: result.response,
              created_at: now,
              analysis: result,
            },
          ]);
          if (result.conversation_id) setConversationId(result.conversation_id);
          if (result.audio_url) {
            if (!audioRef.current) audioRef.current = new Audio();
            audioRef.current.src = result.audio_url;
            void audioRef.current.play().catch(() => undefined);
          }
        } catch (error) {
          showToast({ tone: "error", title: "Voice consultation failed", message: apiErrorMessage(error) });
        } finally {
          setPending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showToast({ tone: "error", title: "Microphone access needed", message: "Allow microphone permission to start a voice consultation." });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-fade-up">
      {emergencyOpen && <EmergencyAlert onClose={() => setEmergencyOpen(false)} />}
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Voice consultation</p>
            <p className="mt-1 text-xs text-slate-500">Speak naturally. We transcribe, respond, and can read the answer aloud when TTS is configured.</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <div className="flex h-20 items-end justify-center gap-1.5">
            {Array.from({ length: 12 }).map((_, index) => (
              <span
                key={index}
                className={`w-2 rounded-full bg-sky-500 origin-bottom ${recording ? "animate-waveform" : "h-3 opacity-40"}`}
                style={{ height: recording ? `${12 + ((index * 7) % 28)}px` : undefined, animationDelay: `${index * 0.05}s` }}
              />
            ))}
          </div>
          <Button
            size="lg"
            variant={recording ? "danger" : "primary"}
            onClick={recording ? stopRecording : startRecording}
            disabled={pending}
          >
            {recording ? <><Square className="h-4 w-4" />Stop recording</> : <><Mic className="h-4 w-4" />Start recording</>}
          </Button>
          <p className="max-w-md text-center text-xs leading-5 text-slate-500">
            If you mention emergency symptoms such as chest pain or difficulty breathing, MediAssist will interrupt normal consultation and urge immediate care.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Conversation</p>
            <p className="mt-1 text-xs text-slate-500">Transcript and educational responses</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 && !pending && <p className="py-8 text-center text-sm text-slate-500">Your voice consultation will appear here.</p>}
          {messages.map((message) => (
            <div key={message.id} className={`rounded-2xl p-4 ${message.role === "user" ? "bg-sky-50 dark:bg-sky-950/20" : "bg-slate-50 dark:bg-slate-950/40"}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{message.role === "user" ? "You said" : "MediAssist"}</p>
              {message.role === "assistant" ? <div className="mt-2"><MarkdownMessage>{message.content}</MarkdownMessage><HealthAnalysisCard analysis={message.analysis} /></div> : <p className="mt-2 text-sm leading-6">{message.content}</p>}
            </div>
          ))}
          {pending && <TypingIndicator />}
        </CardContent>
      </Card>
    </div>
  );
}
