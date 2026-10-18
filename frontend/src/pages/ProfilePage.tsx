import { FormEvent, useState } from "react";
import { Download, Plus, Save, X } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/form";
import { useAuth } from "../contexts/AuthContext";
import { apiErrorMessage, profileApi } from "../lib/api";

function LedgerEditor({
  label,
  hint,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = (event?: FormEvent) => {
    event?.preventDefault();
    const value = draft.trim();
    if (!value) return;
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, value]);
    setDraft("");
  };
  return (
    <div className="sm:col-span-2">
      <Label>{label}</Label>
      <p className="-mt-1 mb-2 text-[11px] text-slate-500">{hint}</p>
      <form onSubmit={add} className="flex gap-2">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} />
        <Button type="submit" variant="outline" className="shrink-0"><Plus className="h-4 w-4" />Add</Button>
      </form>
      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              {item}
              <button type="button" onClick={() => onChange(items.filter((entry) => entry !== item))} aria-label={`Remove ${item}`} className="rounded-full p-0.5 hover:bg-sky-100 dark:hover:bg-sky-500/25">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [allergyList, setAllergyList] = useState<string[]>(user?.allergy_list || []);
  const [medicationList, setMedicationList] = useState<string[]>(user?.medication_list || []);
  const [form, setForm] = useState({
    name: user?.name || "",
    age: user?.age?.toString() || "",
    gender: user?.gender || "",
    blood_group: user?.blood_group || "",
    allergies: user?.allergies || "",
    medical_history: user?.medical_history || "",
    chronic_diseases: user?.chronic_diseases || "",
    current_medications: user?.current_medications || "",
    emergency_contact: user?.emergency_contact || "",
  });

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const blankToNull = (value: string) => (value.trim() ? value.trim() : null);
      const updated = await profileApi.update({
        name: form.name.trim(),
        age: form.age ? Number(form.age) : null,
        gender: blankToNull(form.gender),
        blood_group: blankToNull(form.blood_group),
        allergies: blankToNull(form.allergies),
        medical_history: blankToNull(form.medical_history),
        chronic_diseases: blankToNull(form.chronic_diseases),
        current_medications: blankToNull(form.current_medications),
        emergency_contact: blankToNull(form.emergency_contact),
        allergy_list: allergyList,
        medication_list: medicationList,
      });
      updateUser({ ...updated, email: user?.email || updated.email });
      showToast({ tone: "success", title: "Profile saved" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not save profile", message: apiErrorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const blob = await profileApi.exportData();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mediassist-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast({ tone: "success", title: "Data export downloaded" });
    } catch (error) {
      showToast({ tone: "error", title: "Export failed", message: apiErrorMessage(error) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Your profile</p>
            <p className="mt-1 text-xs text-slate-500">Optional medical details help personalize educational guidance. They are never a substitute for clinical records.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <div className="sm:col-span-2"><Label htmlFor="name">Full name</Label><Input id="name" value={form.name} onChange={update("name")} required /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" value={user?.email || ""} disabled /></div>
            <div><Label htmlFor="age">Age</Label><Input id="age" type="number" min={0} max={120} value={form.age} onChange={update("age")} /></div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <select id="gender" value={form.gender} onChange={update("gender")} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><Label htmlFor="blood_group">Blood group</Label><Input id="blood_group" value={form.blood_group} onChange={update("blood_group")} placeholder="e.g. O+" /></div>
            <div className="sm:col-span-2"><Label htmlFor="allergies">Known allergies</Label><Textarea id="allergies" value={form.allergies} onChange={update("allergies")} placeholder="Medications, foods, environmental…" /></div>
            <div className="sm:col-span-2"><Label htmlFor="medical_history">Medical history</Label><Textarea id="medical_history" value={form.medical_history} onChange={update("medical_history")} /></div>
            <div className="sm:col-span-2"><Label htmlFor="chronic_diseases">Chronic diseases</Label><Textarea id="chronic_diseases" value={form.chronic_diseases} onChange={update("chronic_diseases")} /></div>
            <div className="sm:col-span-2"><Label htmlFor="current_medications">Current medications</Label><Textarea id="current_medications" value={form.current_medications} onChange={update("current_medications")} placeholder="List any daily medications, supplements, or recent antibiotics…" /></div>
            <LedgerEditor label="Allergy ledger" hint="Add each allergy separately so the assistant can check new advice against them." placeholder="e.g. Penicillin" items={allergyList} onChange={setAllergyList} />
            <LedgerEditor label="Medication ledger" hint="Structured list used for conflict and dosing safety checks." placeholder="e.g. Metformin" items={medicationList} onChange={setMedicationList} />
            <div className="sm:col-span-2"><Label htmlFor="emergency_contact">Emergency contact</Label><Input id="emergency_contact" value={form.emergency_contact} onChange={update("emergency_contact")} placeholder="Name and phone number" /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={pending}><Save className="h-4 w-4" />{pending ? "Saving…" : "Save profile"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <div>
            <p className="text-sm font-bold">Your data</p>
            <p className="mt-1 text-xs text-slate-500">Download a copy of your profile, conversations, reports, assessments, images, and reminders as JSON.</p>
          </div>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={exportData} disabled={exporting}><Download className="h-4 w-4" />{exporting ? "Preparing…" : "Export my data"}</Button>
        </CardContent>
      </Card>

      <Card className="mt-8 border-rose-200 dark:border-rose-900/50">
        <CardHeader>
          <div>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">Danger zone</p>
            <p className="mt-1 text-xs text-slate-500">Permanently delete your account and all associated conversations, medical reports, images, and health data.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600 dark:text-slate-400">This action cannot be undone. All stored consultations and reports will be wiped immediately.</p>
            <Button
              type="button"
              variant="outline"
              className="border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/50"
              onClick={async () => {
                if (window.confirm("Are you sure you want to permanently delete your account and all health history? This cannot be undone.")) {
                  try {
                    await profileApi.deleteAccount();
                    showToast({ tone: "success", title: "Account deleted", message: "All your data has been removed." });
                    logout();
                  } catch (err) {
                    showToast({ tone: "error", title: "Deletion failed", message: apiErrorMessage(err) });
                  }
                }
              }}
            >
              Delete account & all data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
