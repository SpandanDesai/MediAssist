import { FormEvent, useEffect, useState } from "react";
import { BellRing, Check, Plus, Trash2 } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/form";
import { Skeleton } from "../components/ui/skeleton";
import { apiErrorMessage, remindersApi } from "../lib/api";
import { displayDate } from "../lib/utils";
import type { Reminder } from "../types";

export function RemindersPage() {
  const { showToast } = useToast();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    remindersApi
      .list()
      .then((items) => { if (live) setReminders(items); })
      .catch(() => { if (live) setReminders([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const created = await remindersApi.create({ title: trimmed, notes: notes.trim() || undefined, due_at: dueAt || undefined });
      setReminders((current) => [...current, created]);
      setTitle("");
      setNotes("");
      setDueAt("");
      showToast({ tone: "success", title: "Reminder added" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not add reminder", message: apiErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(reminder: Reminder) {
    setBusyId(reminder.id);
    try {
      const updated = await remindersApi.update(reminder.id, { done: !reminder.done });
      setReminders((current) => current.map((item) => (item.id === reminder.id ? updated : item)));
    } catch (error) {
      showToast({ tone: "error", title: "Could not update reminder", message: apiErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await remindersApi.remove(id);
      setReminders((current) => current.filter((item) => item.id !== id));
      showToast({ tone: "success", title: "Reminder removed" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not remove reminder", message: apiErrorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  const pending = reminders.filter((item) => !item.done);
  const completed = reminders.filter((item) => item.done);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Care reminders</p>
            <p className="mt-1 text-xs text-ink-2">Track medication refills, follow-ups, and rechecks. Reminders are private to your account.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-4">
            <div>
              <Label htmlFor="reminder-title">What should we remind you about?</Label>
              <Input id="reminder-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Refill metformin" maxLength={200} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="reminder-due">Due date (optional)</Label>
                <Input id="reminder-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={saving || !title.trim()} className="w-full"><Plus className="h-4 w-4" />{saving ? "Adding…" : "Add reminder"}</Button>
              </div>
            </div>
            <div>
              <Label htmlFor="reminder-notes">Notes (optional)</Label>
              <Textarea id="reminder-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything helpful to remember…" maxLength={2000} />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-ink">Your reminders</p>
            <p className="mt-1 text-xs text-ink-2">{pending.length} active · {completed.length} completed</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
          ) : reminders.length === 0 ? (
            <div className="py-8 text-center">
              <BellRing className="mx-auto h-6 w-6 text-ink-2" />
              <p className="mt-3 text-sm font-semibold text-ink">No reminders yet</p>
              <p className="mt-1 text-xs text-ink-2">Add one above to keep track of your next care step.</p>
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {[...pending, ...completed].map((reminder) => (
                <li key={reminder.id} className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 ${reminder.done ? "opacity-60" : ""}`}>
                  <button
                    onClick={() => toggle(reminder)}
                    disabled={busyId === reminder.id}
                    aria-label={reminder.done ? "Mark as not done" : "Mark as done"}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${reminder.done ? "border-low bg-low-tint text-low" : "border-rule text-transparent hover:border-brand"}`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold text-ink ${reminder.done ? "line-through" : ""}`}>{reminder.title}</p>
                    <p className="text-[11px] text-ink-2">{reminder.due_at ? `Due ${displayDate(reminder.due_at)} · ` : ""}{reminder.notes || "No notes"}</p>
                  </div>
                  <button onClick={() => remove(reminder.id)} disabled={busyId === reminder.id} className="rounded-lg p-2 text-ink-2 transition-colors hover:bg-danger-tint hover:text-danger" aria-label={`Delete reminder ${reminder.title}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
