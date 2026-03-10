// src/pages/SharedProfile.tsx
// [FIX Issue 4] Customer profile photo upload was writing to profiles.avatar_url
//   which does not exist (column was dropped). All hooks read profile_photo_url.
//
//   Changes from previous version:
//     1. fetchProfile SELECT: "full_name, avatar_url" → "full_name, profile_photo_url"
//     2. fetchProfile read:   profile?.avatar_url     → profile?.profile_photo_url
//     3. DB UPDATE:           { avatar_url: publicUrl } → { profile_photo_url: publicUrl }
//
//   Storage path unchanged: customers/{uid}/avatar.{ext}
//   ALL other JSX, Tailwind classes, layout — IDENTICAL to original.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared";
import LoadingButton from "@/components/LoadingButton";
import { ArrowLeft, Camera, LogOut, Shield, Settings, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const LANGUAGE_OPTIONS = ["English", "Hindi", "Tamil", "Telugu", "Marathi", "Kannada", "Bengali"];

export default function SharedProfile() {
  const { user, role, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName]                 = useState(user?.name || "");
  const [languages, setLanguages]       = useState<string[]>(["English", "Hindi"]);
  const [saving, setSaving]             = useState(false);
  const [showLogout, setShowLogout]     = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const photoInputRef                   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        // [FIX] was: "full_name, avatar_url"
        .select("full_name, profile_photo_url")
        .eq("id", authData.user.id)
        .single();
      if (profile?.full_name) setName(profile.full_name);
      // [FIX] was: profile?.avatar_url
      if (profile?.profile_photo_url) setPhotoPreview(profile.profile_photo_url);
    };
    fetchProfile();
  }, []);

  const toggleLang = (lang: string) => {
    setLanguages((p) => (p.includes(lang) ? p.filter((l) => l !== lang) : [...p, lang]));
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      setSaving(false);
      toast({ title: "Not authenticated", description: "Please log in again." });
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", authData.user.id);
    if (error) {
      setSaving(false);
      toast({ title: "Could not save profile", description: error.message });
      return;
    }
    await refreshUser();
    setSaving(false);
    toast({ title: "Profile updated ✓" });
  };

  const handleLogout = () => {
    logout();
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const handlePhotoClick = () => {
    if (!uploading) photoInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please select an image under 5MB" });
      return;
    }

    setUploading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const storagePath = `customers/${uid}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(storagePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // [FIX] was: { avatar_url: publicUrl }
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ profile_photo_url: publicUrl })
        .eq("id", uid);

      if (dbError) throw new Error(dbError.message);

      setPhotoPreview(publicUrl);
      await refreshUser();
      toast({ title: "Photo updated ✓" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again",
      });
      setPhotoPreview(null);
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  // ── UI — IDENTICAL TO ORIGINAL ────────────────────────────────────────────
  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Profile</h1>
      </header>

      <div className="px-4 py-5 space-y-6 pb-24">
        {/* Photo */}
        <div className="flex justify-center">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <button
            onClick={handlePhotoClick}
            className="relative h-24 w-24 rounded-full border-2 border-dashed border-primary bg-muted flex items-center justify-center overflow-hidden"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-7 w-7 text-primary" />
            )}
            <div className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center border-2 border-card">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 text-primary-foreground animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5 text-primary-foreground" />
              )}
            </div>
          </button>
        </div>

        {/* Role badge */}
        <div className="flex justify-center">
          <span className="text-sm font-semibold text-foreground capitalize">{role}</span>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Full Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Phone Number</label>
          <Input value={`+91 ${user?.phone || ""}`} readOnly className="bg-muted" />
          <p className="text-xs text-muted-foreground">Contact support to change your phone number.</p>
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
                  languages.includes(lang) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Notification settings shortcut */}
        <button
          onClick={() => navigate("/settings")}
          className="touch-target w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
        >
          <Settings className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Notification Settings</span>
        </button>

        {/* Account security */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-5 w-5 text-accent" />
            <span className="text-sm font-bold text-foreground">Account Security</span>
          </div>
          <p className="text-xs text-muted-foreground">Active sessions: 1 device</p>
        </div>

        {/* Save */}
        <LoadingButton loading={saving} onClick={handleSave}>Save Profile</LoadingButton>

        {/* Logout */}
        <button
          onClick={() => setShowLogout(true)}
          className="touch-target w-full flex items-center justify-center gap-2 rounded-lg border-2 border-destructive py-3.5 text-destructive font-semibold hover:bg-destructive/5 transition-default"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>

      <ConfirmDialog
        isOpen={showLogout}
        title="Log Out?"
        body="You'll need to log in again to access your account."
        confirmLabel="Log Out"
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
        destructive
      />
    </div>
  );
}