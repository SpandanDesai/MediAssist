import { FormEvent, useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Input, Label, Textarea } from "../components/ui/form";
import { useAuth } from "../contexts/AuthContext";
import { apiErrorMessage, profileApi } from "../lib/api";

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
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
      const updated = await profileApi.update({
        name: form.name.trim(),
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        allergies: form.allergies || null,
        medical_history: form.medical_history || null,
        chronic_diseases: form.chronic_diseases || null,
        current_medications: form.current_medications || null,
        emergency_contact: form.emergency_contact || null,
      });
      updateUser({ ...updated, email: user?.email || updated.email });
      showToast({ tone: "success", title: "Profile saved" });
    } catch (error) {
      showToast({ tone: "error", title: "Could not save profile", message: apiErrorMessage(error) });
    } finally {
      setPending(false);
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
            <div className="sm:col-span-2"><Label htmlFor="emergency_contact">Emergency contact</Label><Input id="emergency_contact" value={form.emergency_contact} onChange={update("emergency_contact")} placeholder="Name and phone number" /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={pending}><Save className="h-4 w-4" />{pending ? "Saving…" : "Save profile"}</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
