import { useEffect, useState } from "react";
import { Ban, Download, FileText, Link2, ListChecks, Loader2 } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { apiErrorMessage, baseURL, historyApi, reportApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { Conversation } from "../types";

interface ShareLink {
  share_id: string;
  jti: string;
  revoked: boolean;
  access_count: number;
  created_at: string;
}

export function ReportsPage() {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [reports, setReports] = useState<Array<{ id: string; title: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [openSharesId, setOpenSharesId] = useState<string | null>(null);
  const [sharesByReport, setSharesByReport] = useState<Record<string, ShareLink[]>>({});
  const [loadingShares, setLoadingShares] = useState(false);
  const [revokingJti, setRevokingJti] = useState<string | null>(null);

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
    return () => { live = false; };
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

  async function createShareLink(id: string) {
    setSharingId(id);
    try {
      const share = await reportApi.createShareLink(id);
      const link = `${baseURL}${share.path}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(link);
        copied = true;
      } catch {
        window.prompt("Copy this report link:", link);
      }
      showToast({
        tone: "success",
        title: copied ? "Share link copied" : "Share link ready",
        message: `Anyone with this link can view the report for ${share.expires_in_minutes} minutes.`,
      });
      // Refresh the open panel so the new link appears immediately.
      if (openSharesId === id) await loadShares(id);
    } catch (error) {
      showToast({ tone: "error", title: "Could not create share link", message: apiErrorMessage(error) });
    } finally {
      setSharingId(null);
    }
  }

  async function loadShares(id: string) {
    setLoadingShares(true);
    try {
      const list = await reportApi.listShareLinks(id);
      setSharesByReport((current) => ({ ...current, [id]: list }));
    } catch (error) {
      showToast({ tone: "error", title: "Could not load share links", message: apiErrorMessage(error) });
    } finally {
      setLoadingShares(false);
    }
  }

  async function toggleShares(id: string) {
    if (openSharesId === id) {
      setOpenSharesId(null);
      return;
    }
    setOpenSharesId(id);
    if (!sharesByReport[id]) await loadShares(id);
  }

  async function revokeShare(reportId: string, jti: string) {
    setRevokingJti(jti);
    try {
      await reportApi.revokeShareLink(reportId, jti);
      setSharesByReport((current) => ({
        ...current,
        [reportId]: (current[reportId] || []).map((item) => (item.jti === jti ? { ...item, revoked: true } : item)),
      }));
      showToast({ tone: "success", title: "Share link revoked", message: "Anyone using that link can no longer open the report." });
    } catch (error) {
      showToast({ tone: "error", title: "Could not revoke link", message: apiErrorMessage(error) });
    } finally {
      setRevokingJti(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Generate from a conversation</p>
            <p className="mt-1 text-xs text-ink-2">Includes symptoms, possible conditions, recommendations, and disclaimer.</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>}
          {!loading && !conversations.length && <p className="py-10 text-center text-sm text-ink-2">No conversations available yet.</p>}
          <ul className="divide-y divide-rule">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{conversation.title}</p>
                  <p className="text-[11px] text-ink-2">{displayDate(conversation.updated_at)}</p>
                </div>
                <Button size="sm" variant="outline" disabled={generatingId === conversation.id} onClick={() => generate(conversation.id)}>
                  <Download className="h-3.5 w-3.5" />{generatingId === conversation.id ? "…" : "Generate PDF"}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Saved reports</p>
            <p className="mt-1 text-xs text-ink-2">Previously generated educational summaries</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>}
          {!loading && !reports.length && <p className="py-10 text-center text-sm text-ink-2">No saved reports yet.</p>}
          <ul className="divide-y divide-rule">
            {reports.map((report) => {
              const shares = sharesByReport[report.id];
              const isOpen = openSharesId === report.id;
              const activeCount = (shares || []).filter((item) => !item.revoked).length;
              return (
                <li key={report.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{report.title}</p>
                      <p className="text-[11px] text-ink-2">{displayDate(report.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" title="Create a temporary share link" aria-label="Create a temporary share link" disabled={sharingId === report.id} onClick={() => createShareLink(report.id)}>
                        {sharingId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Manage share links" title="Manage share links" onClick={() => toggleShares(report.id)}>
                        <ListChecks className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Download report" onClick={() => downloadExisting(report.id)}><Download className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 rounded-xl border border-rule bg-surface-alt p-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">
                        Share links{activeCount > 0 ? ` · ${activeCount} active` : ""}
                      </p>
                      {loadingShares && !shares ? (
                        <div className="space-y-2">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-10" />)}</div>
                      ) : !shares || shares.length === 0 ? (
                        <p className="text-xs text-ink-2">No share links created for this report yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {shares.map((share) => (
                            <li key={share.jti || share.share_id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-ink">
                                  Created {displayDate(share.created_at)}
                                  <span className="ml-2 text-ink-2">· {share.access_count} open{share.access_count === 1 ? "" : "s"}</span>
                                </p>
                                <p className={`text-[11px] ${share.revoked ? "text-danger" : "text-low"}`}>{share.revoked ? "Revoked" : "Active"}</p>
                              </div>
                              {share.revoked ? (
                                <span className="shrink-0 text-[11px] font-semibold text-ink-2">No longer valid</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-danger hover:bg-danger-tint hover:text-danger"
                                  disabled={revokingJti === share.jti}
                                  onClick={() => revokeShare(report.id, share.jti)}
                                  aria-label="Revoke this share link"
                                >
                                  {revokingJti === share.jti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}Revoke
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
