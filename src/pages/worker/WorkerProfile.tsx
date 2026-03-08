// src/pages/worker/WorkerProfile.tsx
// POLISH [ISSUE 2]:
//   Camera button now opens a real file picker → uploads to Supabase
//   "profile-photos" storage bucket → saves public URL in profiles.avatar_url
// ALL JSX, Tailwind classes, state, other handlers — IDENTICAL to original.

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import LoadingButton from "@/components/LoadingButton";
import { Camera, X, Plus, MapPin, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const LANGUAGE_OPTIONS = ["English", "Hindi", "Tamil", "Telugu", "Marathi", "Kannada", "Bengali"];

export default function WorkerProfile() {
  const { user } = useAuth();
  const [name, setName]           = useState(user?.name || "");
  const [languages, setLanguages] = useState<string[]>([]);
  const [skills, setSkills]       = useState<string[]>([]);
  const [tools, setTools]         = useState<string[]>([]);
  const [radius, setRadius]       = useState([5]);
  const [saving, setSaving]       = useState(false);
  const [newSkill, setNewSkill]   = useState("");
  const [newTool, setNewTool]     = useState("");

  // [POLISH 2] Profile photo state
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const toggleLang = (lang: string) => {
    setLanguages((p) => (p.includes(lang) ? p.filter((l) => l !== lang) : [...p, lang]));
  };

  // [POLISH 2] Upload profile photo → Supabase storage → save URL in profiles
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) { setUploadingPhoto(false); return; }

    const userId = authData.user.id;
    const ext    = file.name.split(".").pop() ?? "jpg";
    const path   = `workers/${userId}/avatar.${ext}`;

    // Upload (upsert — overwrite previous photo)
    const { error: uploadErr } = await supabase.storage
      .from("profile-photos")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      setUploadingPhoto(false);
      toast({ title: "Upload failed", description: uploadErr.message });
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Save to profiles.avatar_url
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    setUploadingPhoto(false);

    if (dbErr) {
      toast({ title: "Could not save photo", description: dbErr.message });
      return;
    }

    setAvatarUrl(publicUrl);
    // Reset so same file can be re-selected
    if (photoInputRef.current) photoInputRef.current.value = "";
    toast({ title: "Profile photo updated ✓" });
  };

  // ── handleSave — real Supabase writes ─────────────────────────────────────
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

    // 3. Replace skills
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

    const knownSkills = skills.filter((s) => categoryMap.has(s));

    await supabase.from("worker_skills").delete().eq("worker_id", userId);

    if (knownSkills.length > 0) {
      const { error: skillsErr } = await supabase.from("worker_skills").insert(
        knownSkills.map((s) => ({
          worker_id:        userId,
          category_id:      categoryMap.get(s)!,
          experience_level: "Intermediate",
        }))
      );
      if (skillsErr) {
        setSaving(false);
        toast({ title: "Could not save skills", description: skillsErr.message });
        return;
      }
    }

    // 4. Replace tools
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

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const userId = authData.user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profile?.full_name) setName(profile.full_name);
      // [POLISH 2] Load existing avatar
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

      const { data: workerProfile } = await supabase
        .from("worker_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (workerProfile?.service_radius_km) setRadius([workerProfile.service_radius_km]);

      const { data: skillsData } = await supabase
        .from("worker_skills")
        .select("service_categories(name)")
        .eq("worker_id", userId);

      if (skillsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSkills(skillsData.map((s: any) => s.service_categories?.name).filter(Boolean));
      }

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

      {/* [POLISH 2] Photo — now opens real file picker */}
      <div className="flex justify-center">
        <button
          onClick={() => photoInputRef.current?.click()}
          className="relative h-24 w-24 rounded-full border-2 border-dashed border-primary bg-muted flex items-center justify-center overflow-hidden"
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? (
            <Loader2 className="h-7 w-7 text-primary animate-spin" />
          ) : avatarUrl ? (
            <>
              <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </>
          ) : (
            <Camera className="h-7 w-7 text-primary" />
          )}
        </button>
        {/* Hidden file input */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
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