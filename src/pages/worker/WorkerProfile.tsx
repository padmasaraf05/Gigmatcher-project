// src/pages/worker/WorkerProfile.tsx
// PHASE 3 CHANGE: handleSave() replaced with real Supabase writes.
// fetchProfile() was already real — unchanged.
// ALL JSX, Tailwind classes, state, UI — IDENTICAL to original.

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import LoadingButton from "@/components/LoadingButton";
import { Camera, X, Plus, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const LANGUAGE_OPTIONS = ["English", "Hindi", "Tamil", "Telugu", "Marathi", "Kannada", "Bengali"];

export default function WorkerProfile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [languages, setLanguages] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [radius, setRadius] = useState([5]);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [newTool, setNewTool] = useState("");

  const toggleLang = (lang: string) => {
    setLanguages((p) => (p.includes(lang) ? p.filter((l) => l !== lang) : [...p, lang]));
  };

  // ── handleSave — PHASE 3: real Supabase writes ────────────────────────────
  const handleSave = async () => {
    setSaving(true);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      setSaving(false);
      toast({ title: "Not authenticated", description: "Please log in again." });
      return;
    }
    const userId = authData.user.id;

    // 1. Update full_name in profiles
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", userId);

    if (profileErr) {
      setSaving(false);
      toast({ title: "Could not save name", description: profileErr.message });
      return;
    }

    // 2. Update service_radius_km in worker_profiles
    const { error: wpErr } = await supabase
      .from("worker_profiles")
      .update({ service_radius_km: radius[0] })
      .eq("user_id", userId);

    if (wpErr) {
      setSaving(false);
      toast({ title: "Could not save service area", description: wpErr.message });
      return;
    }

    // 3. Replace skills — look up category UUIDs by name, then delete + insert
    const { data: categories, error: catErr } = await supabase
      .from("service_categories")
      .select("id, name");

    if (catErr || !categories) {
      setSaving(false);
      toast({ title: "Could not load categories", description: catErr?.message });
      return;
    }

    const categoryMap = new Map<string, string>(
      categories.map((c: { id: string; name: string }) => [c.name, c.id])
    );

    // Skills the user typed that match known categories
    const knownSkills = skills.filter((s) => categoryMap.has(s));
    // Custom skills without a DB category are dropped silently —
    // they were display-only additions via the free-text input.

    await supabase.from("worker_skills").delete().eq("worker_id", userId);

    if (knownSkills.length > 0) {
      const { error: skillsErr } = await supabase.from("worker_skills").insert(
        knownSkills.map((s) => ({
          worker_id: userId,
          category_id: categoryMap.get(s)!,
          experience_level: "Intermediate", // profile page has no level picker — use default
        }))
      );
      if (skillsErr) {
        setSaving(false);
        toast({ title: "Could not save skills", description: skillsErr.message });
        return;
      }
    }

    // 4. Replace tools — simple string list, no UUID mapping needed
    await supabase.from("worker_tools").delete().eq("worker_id", userId);

    if (tools.length > 0) {
      const { error: toolsErr } = await supabase.from("worker_tools").insert(
        tools.map((t) => ({ worker_id: userId, tool_name: t }))
      );
      if (toolsErr) {
        setSaving(false);
        toast({ title: "Could not save tools", description: toolsErr.message });
        return;
      }
    }

    setSaving(false);
    toast({ title: "Profile saved ✓", description: "Your changes have been updated" });
  };
  // ── end handleSave ─────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const userId = authData.user.id;

      // Fetch common profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profile?.full_name) {
        setName(profile.full_name);
      }

      // Fetch worker profile
      const { data: workerProfile } = await supabase
        .from("worker_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (workerProfile?.service_radius_km) {
        setRadius([workerProfile.service_radius_km]);
      }

      // Fetch skills
      const { data: skillsData } = await supabase
        .from("worker_skills")
        .select("service_categories(name)")
        .eq("worker_id", userId);

      if (skillsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const skillNames = skillsData.map((s: any) => s.service_categories?.name).filter(Boolean);
        setSkills(skillNames);
      }

      // Fetch tools
      const { data: toolsData } = await supabase
        .from("worker_tools")
        .select("tool_name")
        .eq("worker_id", userId);

      if (toolsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTools(toolsData.map((t: any) => t.tool_name));
      }
    };

    fetchProfile();
  }, []);

  // ── UI — IDENTICAL TO ORIGINAL ────────────────────────────────────────────
  return (
    <div className="px-4 py-5 space-y-6 animate-fade-in pb-24">
      <h2 className="text-xl font-bold text-foreground">Profile</h2>

      {/* Photo */}
      <div className="flex justify-center">
        <button className="relative h-24 w-24 rounded-full border-2 border-dashed border-primary bg-muted flex items-center justify-center overflow-hidden">
          <Camera className="h-7 w-7 text-primary" />
        </button>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Full Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Phone (read-only) */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Phone</label>
        <Input value={`+91 ${user?.phone || ""}`} readOnly className="bg-muted" />
      </div>

      {/* Languages */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Languages Spoken</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang}
              onClick={() => toggleLang(lang)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-default ${
                languages.includes(lang)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Skills</label>
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <span key={s} className="flex items-center gap-1 rounded-full bg-accent/10 text-accent px-3 py-1.5 text-xs font-semibold">
              {s}
              <button onClick={() => setSkills((p) => p.filter((x) => x !== s))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Add skill..." value={newSkill} onChange={(e) => setNewSkill(e.target.value)} />
          <button
            onClick={() => { if (newSkill.trim()) { setSkills((p) => [...p, newSkill.trim()]); setNewSkill(""); } }}
            className="touch-target shrink-0 rounded-lg bg-primary px-4 text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Tool Inventory</label>
        <div className="flex flex-wrap gap-2">
          {tools.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold">
              {t}
              <button onClick={() => setTools((p) => p.filter((x) => x !== t))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Add tool..." value={newTool} onChange={(e) => setNewTool(e.target.value)} />
          <button
            onClick={() => { if (newTool.trim()) { setTools((p) => [...p, newTool.trim()]); setNewTool(""); } }}
            className="touch-target shrink-0 rounded-lg bg-primary px-4 text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Service Area */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Service Area</label>
        <div className="h-32 rounded-xl bg-muted border border-border flex items-center justify-center">
          <MapPin className="h-8 w-8 text-primary" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Radius: {radius[0]} km</span>
          <button className="text-primary font-semibold text-xs">Edit</button>
        </div>
        <Slider min={1} max={20} step={1} value={radius} onValueChange={setRadius} />
      </div>

      {/* Save */}
      <LoadingButton loading={saving} onClick={handleSave}>
        Save Changes
      </LoadingButton>
    </div>
  );
}