// src/pages/worker/WorkerOnboarding.tsx
// PHASE 3 CHANGE (1 line block, marked // [P2]):
//   worker_profiles upsert now includes hourly_rate and availability_days
//   (columns added in Phase 1 — must be present or DB will use column defaults)
// ALL UI, JSX, Tailwind classes, step logic — IDENTICAL to original.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import LoadingButton from "@/components/LoadingButton";
import { SKILL_OPTIONS, TOOLS_BY_SKILL } from "@/hooks/useWorkerApi";
import {
  Search, MapPin, Plus, Camera, ChevronLeft, ChevronRight, Award, Check,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

type ExpLevel = "Beginner" | "Intermediate" | "Expert";
interface SkillEntry { name: string; level: ExpLevel }

const SCHEMES = [
  { name: "PM Vishwakarma Yojana", desc: "Financial assistance for traditional artisans", eligible: true },
  { name: "PMEGP", desc: "Micro enterprise generation programme", eligible: false },
];

export default function WorkerOnboarding() {
  const navigate = useNavigate();
  const { user, language } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [skillSearch, setSkillSearch] = useState("");

  // Step 2
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [customTool, setCustomTool] = useState("");

  // Step 3
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState([5]);
  const [manualArea, setManualArea] = useState("");

  // Step 4
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const progress = step * 25;

  const toggleSkill = (name: string) => {
    setSkills((prev) =>
      prev.find((s) => s.name === name)
        ? prev.filter((s) => s.name !== name)
        : [...prev, { name, level: "Beginner" }]
    );
  };

  const setSkillLevel = (name: string, level: ExpLevel) => {
    setSkills((prev) => prev.map((s) => (s.name === name ? { ...s, level } : s)));
  };

  const filteredSkills = SKILL_OPTIONS.filter((s) =>
    s.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const allTools = Array.from(
    new Set(skills.flatMap((s) => TOOLS_BY_SKILL[s.name] || []))
  );

  const handleLocate = () => {
    setLocation("Indore, Madhya Pradesh");
    toast({ title: "Location detected", description: "Indore, MP" });
  };

  const handlePhotoMock = () => {
    setPhotoPreview("/placeholder.svg");
    toast({ title: "Photo selected" });
  };

  const handleComplete = async () => {
    try {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setLoading(false);
        toast({ title: "Unable to complete onboarding", description: "Please login again." });
        return;
      }

      const workerId = authData.user.id;

      const { data: categories, error: catError } = await supabase
        .from("service_categories")
        .select("id, name");

      if (catError || !categories) {
        setLoading(false);
        toast({ title: "Setup incomplete", description: "Service categories are not configured yet." });
        return;
      }

      const categoryMap = new Map<string, string>(
        categories.map((c: { id: string; name: string }) => [c.name, c.id]),
      );

      const missingCategories = skills
        .map((s) => s.name)
        .filter((name) => !categoryMap.has(name));

      if (missingCategories.length > 0) {
        setLoading(false);
        toast({
          title: "Missing categories",
          description: `These skills are not configured: ${missingCategories.join(", ")}`,
        });
        return;
      }

      const skillsPayload = skills.map((s) => ({
        worker_id: workerId,
        category_id: categoryMap.get(s.name)!,
        experience_level: s.level,
      }));

      const toolsPayload = selectedTools.map((tool) => ({
        worker_id: workerId,
        tool_name: tool,
      }));

      const schemeEligible = SCHEMES.some((s) => s.eligible);

      const fullName = user?.name ?? undefined;
      const phoneFromUser = user?.phone ?? undefined;
      const phoneFromAuth = authData.user.phone ?? undefined;

      const normalizePhoneDigits = (value?: string | null) => {
        if (!value) return null;
        const digits = value.replace(/\D/g, "");
        return digits.length >= 10 ? digits.slice(-10) : null;
      };

      const phoneDigits =
        normalizePhoneDigits(phoneFromUser) ?? normalizePhoneDigits(phoneFromAuth);

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: workerId,
          role: "worker",
          full_name: fullName,
          phone: phoneDigits,
          language: language,
          profile_photo_url: null,
        },
        { onConflict: "id" },
      );

      if (profileError) {
        setLoading(false);
        toast({ title: "Could not save profile", description: profileError.message });
        return;
      }

      // [P3] Added hourly_rate and availability_days — required by Phase 1 schema.
      // hourly_rate defaults to 0 (worker sets it later in WorkerProfile).
      // availability_days defaults to all 7 days available.
      const { error: workerProfileError } = await supabase.from("worker_profiles").upsert(
        {
          user_id: workerId,
          service_radius_km: radius[0],
          latitude: null,
          longitude: null,
          is_available: false,
          is_pro: false,
          scheme_eligible: schemeEligible,
          rating: 0,
          total_reviews: 0,
          hourly_rate: 0,                                           // [P3]
          availability_days: [true, true, true, true, true, true, true], // [P3]
        },
        { onConflict: "user_id" },
      );

      if (workerProfileError) {
        setLoading(false);
        toast({ title: "Could not save worker profile", description: workerProfileError.message });
        return;
      }

      const { error: deleteSkillsError } = await supabase
        .from("worker_skills")
        .delete()
        .eq("worker_id", workerId);

      if (deleteSkillsError) {
        setLoading(false);
        toast({ title: "Could not update skills", description: deleteSkillsError.message });
        return;
      }

      if (skillsPayload.length > 0) {
        const { error: insertSkillsError } = await supabase
          .from("worker_skills")
          .insert(skillsPayload);
        if (insertSkillsError) {
          setLoading(false);
          toast({ title: "Could not save skills", description: insertSkillsError.message });
          return;
        }
      }

      const { error: deleteToolsError } = await supabase
        .from("worker_tools")
        .delete()
        .eq("worker_id", workerId);

      if (deleteToolsError) {
        setLoading(false);
        toast({ title: "Could not update tools", description: deleteToolsError.message });
        return;
      }

      if (toolsPayload.length > 0) {
        const { error: insertToolsError } = await supabase
          .from("worker_tools")
          .insert(toolsPayload);
        if (insertToolsError) {
          setLoading(false);
          toast({ title: "Could not save tools", description: insertToolsError.message });
          return;
        }
      }

      setLoading(false);
      toast({ title: "Registration complete! 🎉", description: "Welcome to GigMatcher" });
      navigate("/worker", { replace: true });
    } catch (e) {
      setLoading(false);
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      toast({ title: "Unexpected error", description: message });
    }
  };

  const canNext =
    (step === 1 && skills.length > 0) ||
    (step === 2) ||
    (step === 3 && (location || manualArea)) ||
    (step === 4);

  // ── UI — IDENTICAL TO ORIGINAL ────────────────────────────────────────────
  return (
    <div className="app-shell min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-foreground">Complete Your Profile</h1>
          <span className="text-sm text-muted-foreground">Step {step}/4</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 animate-fade-in">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Select Your Skills</h2>
            <p className="text-sm text-muted-foreground">Choose services you can offer</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {filteredSkills.map((skill) => {
                const selected = skills.find((s) => s.name === skill);
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`touch-target rounded-xl border-2 p-3 text-left transition-default ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground">{skill}</span>
                    {selected && (
                      <Check className="inline ml-1.5 h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {skills.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-foreground">Experience Level</h3>
                {skills.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="text-sm text-foreground w-24 shrink-0">{s.name}</span>
                    <div className="flex gap-1.5">
                      {(["Beginner", "Intermediate", "Expert"] as ExpLevel[]).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setSkillLevel(s.name, lvl)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-default ${
                            s.level === lvl
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Tools & Equipment</h2>
            <p className="text-sm text-muted-foreground">Select tools you own</p>
            {allTools.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Go back and select skills first</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {allTools.map((tool) => {
                  const checked = selectedTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      onClick={() =>
                        setSelectedTools((p) =>
                          checked ? p.filter((t) => t !== tool) : [...p, tool]
                        )
                      }
                      className={`relative rounded-xl border-2 p-3 text-left transition-default ${
                        checked ? "border-accent bg-accent/5" : "border-border bg-card hover:border-accent/40"
                      }`}
                    >
                      {checked && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                          <Check className="h-3 w-3 text-accent-foreground" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-foreground">{tool}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom tool..."
                value={customTool}
                onChange={(e) => setCustomTool(e.target.value)}
              />
              <button
                onClick={() => {
                  if (customTool.trim()) {
                    setSelectedTools((p) => [...p, customTool.trim()]);
                    setCustomTool("");
                  }
                }}
                className="touch-target shrink-0 rounded-lg bg-primary px-4 text-primary-foreground transition-default hover:opacity-90"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Service Area</h2>
            <p className="text-sm text-muted-foreground">Set your work location and radius</p>

            <div className="relative h-48 rounded-xl bg-muted border border-border flex items-center justify-center">
              <MapPin className="h-10 w-10 text-primary" />
              {location && (
                <span className="absolute bottom-3 left-3 bg-card rounded-lg px-3 py-1.5 text-xs font-medium text-foreground shadow-sm border border-border">
                  📍 {location}
                </span>
              )}
            </div>

            <LoadingButton variant="outline" onClick={handleLocate}>
              <MapPin className="h-4 w-4" /> Use My Current Location
            </LoadingButton>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Service Radius: {radius[0]} km
              </label>
              <Slider min={1} max={20} step={1} value={radius} onValueChange={setRadius} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 km</span>
                <span>20 km</span>
              </div>
            </div>

            <Input
              placeholder="Or enter city/area manually"
              value={manualArea}
              onChange={(e) => setManualArea(e.target.value)}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-foreground">Almost Done!</h2>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handlePhotoMock}
                className="relative h-28 w-28 rounded-full border-2 border-dashed border-primary bg-muted flex items-center justify-center overflow-hidden transition-default hover:border-primary/70"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-primary" />
                )}
              </button>
              <span className="text-sm text-muted-foreground">Tap to add profile photo</span>
            </div>

            <h3 className="text-lg font-bold text-foreground">Government Schemes</h3>
            {SCHEMES.map((scheme) => (
              <div
                key={scheme.name}
                className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
              >
                <Award className={`h-8 w-8 shrink-0 ${scheme.eligible ? "text-accent" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{scheme.name}</span>
                    {scheme.eligible && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        Eligible
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{scheme.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="touch-target flex-1 rounded-lg border-2 border-border py-3 font-semibold text-foreground transition-default hover:bg-muted flex items-center justify-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}
        {step < 4 ? (
          <LoadingButton
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex-1"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </LoadingButton>
        ) : (
          <LoadingButton
            loading={loading}
            onClick={handleComplete}
            variant="primary"
            className="flex-1"
          >
            Complete Registration 🎉
          </LoadingButton>
        )}
      </div>
    </div>
  );
}