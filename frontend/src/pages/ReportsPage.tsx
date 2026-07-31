import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { apiErrorMessage, historyApi, reportApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { Conversation } from "../types";

export function ReportsPage() {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [reports, setReports] = useState<Array<{ id: string; title: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([historyApi.list(), reportApi.list()])
      .then(([history, reportList]) => {
        if (!live) return;
        setConversations(history);
        setReports(reportList);
      })
      .catch(() => {
        if (!live) return;
        setConversations([]);
        setReports([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  async function generate(conversationId: string) {
    setGeneratingId(conversationId);
    try {
      const response = await reportApi.generate(conversationId);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mediassist-report-${conversationId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      const list = await reportApi.list().catch(() => reports);
      setReports(list);
      showToast({ tone: "success", title: "PDF report ready" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not generate report", message: apiErrorMessage(error) });
    } finally {
      setGeneratingId(null);
    }
  }

  async function downloadExisting(id: string) {
    try {
      const response = await reportApi.download(id);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mediassist-report-${id}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast({ tone: "error", title: "Download failed", message: apiErrorMessage(error) });
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2 animate-fade-up">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Generate from a conversation</p>
            <p className="mt-1 text-xs text-slate-500">Includes symptoms, possible conditions, recommendations, and disclaimer.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
          {!loading && !conversations.length && <p className="py-10 text-center text-sm text-slate-500">No conversations available yet.</p>}
          {conversations.map((conversation) => (
            <div key={conversation.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><FileText className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{conversation.title}</p>
                <p className="text-[11px] text-slate-500">{displayDate(conversation.updated_at)}</p>
              </div>
              <Button size="sm" variant="outline" disabled={generatingId === conversation.id} onClick={() => generate(conversation.id)}>
                <Download className="h-3.5 w-3.5" />{generatingId === conversation.id ? "…" : "PDF"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Saved reports</p>
            <p className="mt-1 text-xs text-slate-500">Previously generated educational summaries</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14" />)}
          {!loading && !reports.length && <p className="py-10 text-center text-sm text-slate-500">No saved reports yet.</p>}
          {reports.map((report) => (
            <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{report.title}</p>
                <p className="text-[11px] text-slate-500">{displayDate(report.created_at)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => downloadExisting(report.id)}><Download className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
