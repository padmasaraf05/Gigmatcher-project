// src/pages/VerifyOtpPage.tsx
// PHASE 2 CHANGES (marked with // [P2]):
//   1. INSERT profiles row for new registrations (worker + customer)
//   2. Thread supaUser.id into all register() / login() calls
//   3. Pass id through the profileError fallback path
// UI, layout, JSX, navigation logic — UNCHANGED.

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import LoadingButton from "@/components/LoadingButton";
import { ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UserRole, LanguageCode } from "@/lib/types"; // [P2] added LanguageCode

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  const phone: string = location.state?.phone || "";
  const fromRegister: boolean = location.state?.fromRegister || false;
  const registerData = location.state?.registerData;
  const isUserRole = (r: unknown): r is UserRole => r === "worker" || r === "customer";
  const isValidLanguage = (l: unknown): l is LanguageCode =>   // [P2]
    l === "en" || l === "hi" || l === "ta" || l === "te" || l === "mr";

  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!phone) {
      navigate("/login", { replace: true });
    }
  }, [phone, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((p) => p - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // [P2] Helper: create profiles row for a new user.
  // Called only when noProfile is confirmed. Safe to call once.
  const createProfileRow = async (
    userId: string,
    role: UserRole,
    name: string,
    phoneDigits: string,
    language: LanguageCode
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      role,
      full_name: name,
      phone: phoneDigits.replace(/\D/g, "").slice(-10),
      language,
    });
    return { error: error?.message ?? null };
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 6) return;
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token: code,
      type: "sms",
    });

    if (error) {
      setLoading(false);
      toast({ title: "Invalid OTP", description: error.message });
      return;
    }

    const metadata = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    const metaRole = isUserRole(metadata.role) ? metadata.role : undefined;

    // Ensure basic metadata for fresh registrations is present.
    if (fromRegister && registerData && !metaRole) {
      await supabase.auth.updateUser({
        data: { ...metadata, role: registerData.role, name: registerData.name, language: registerData.language },
      });
    }

    // 1) Get current authenticated user
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setLoading(false);
      toast({ title: "Unable to complete login", description: "Please try again." });
      return;
    }
    const supaUser = userResult.user;

    // 2) Try to load profile row
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", supaUser.id)
      .single();

    // Helper to read any previously stored role for this phone
    const stored = localStorage.getItem("gm_user");
    let storedRole: UserRole | undefined;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { phone?: string; role?: unknown };
        if (parsed?.phone === phone && isUserRole(parsed.role)) {
          storedRole = parsed.role;
        }
      } catch {
        // ignore parse errors
      }
    }

    // 3) If no profile row exists
    const noProfile =
      (profileError && (profileError as { code?: string }).code === "PGRST116") ||
      (!profile && !profileError);

    if (noProfile) {
      // Fresh worker registration → create profile row, then send to onboarding
      if (fromRegister && registerData?.role === "worker") {
        const lang: LanguageCode = isValidLanguage(registerData.language) // [P2]
          ? registerData.language
          : "en";
        const { error: insertErr } = await createProfileRow(  // [P2]
          supaUser.id,
          "worker",
          registerData.name ?? "",
          phone,
          lang
        );
        if (insertErr) {
          toast({ title: "Registration error", description: insertErr });
        }
        register({ ...registerData, id: supaUser.id, language: lang }); // [P2] added id
        setLoading(false);
        navigate("/worker/onboarding", { replace: true });
        return;
      }

      // Fresh customer registration → create profile row, then go to customer dashboard
      if (fromRegister && registerData?.role === "customer") {
        const lang: LanguageCode = isValidLanguage(registerData.language) // [P2]
          ? registerData.language
          : "en";
        const { error: insertErr } = await createProfileRow(  // [P2]
          supaUser.id,
          "customer",
          registerData.name ?? "",
          phone,
          lang
        );
        if (insertErr) {
          toast({ title: "Registration error", description: insertErr });
        }
        register({ ...registerData, id: supaUser.id, language: lang }); // [P2] added id
        setLoading(false);
        navigate("/customer", { replace: true });
        return;
      }

      // No profile and no registration context → send back to register
      setLoading(false);
      navigate("/register", { replace: true });
      return;
    }

    // Any other profile error: fail gracefully but still fall back to role-based navigation.
    if (profileError) {
      const fallbackRole: UserRole =
        (metaRole as UserRole | undefined) ??
        storedRole ??
        (phone === "9999999999" ? "worker" : "customer");

      if (fromRegister && registerData) {
        register({ ...registerData, id: supaUser.id, role: fallbackRole }); // [P2] added id
      } else {
        login(phone, fallbackRole); // login() in AuthContext handles empty id gracefully
      }

      setLoading(false);
      toast({ title: "Partial login", description: "Some profile data could not be loaded." });
      navigate(fallbackRole === "worker" ? "/worker" : "/customer", { replace: true });
      return;
    }

    // 4) Profile exists → decide role and onboarding completion
    const profileRole = isUserRole((profile as { role?: unknown }).role)
      ? ((profile as { role: UserRole }).role)
      : undefined;

    const effectiveRole: UserRole =
      profileRole ??
      (metaRole as UserRole | undefined) ??
      storedRole ??
      (phone === "9999999999" ? "worker" : "customer");

    // Worker onboarding completion check
    let onboardingComplete = false;
    if (effectiveRole === "worker") {
      const { data: workerSkills, error: skillsError } = await supabase
        .from("worker_skills")
        .select("id")
        .eq("worker_id", supaUser.id)
        .limit(1);

      const hasSkills = !skillsError && !!workerSkills && workerSkills.length > 0;

      const { data: workerProfile, error: workerProfileError } = await supabase
        .from("worker_profiles")
        .select("service_radius_km")
        .eq("user_id", supaUser.id)
        .maybeSingle();

      const hasRadius =
        !workerProfileError &&
        !!workerProfile &&
        (workerProfile as { service_radius_km?: number | null }).service_radius_km !== null &&
        (workerProfile as { service_radius_km?: number | null }).service_radius_km !== undefined;

      onboardingComplete = hasSkills && hasRadius;
    }

    // Sync auth context before navigating
    if (fromRegister && registerData) {
      register({ ...registerData, id: supaUser.id, role: effectiveRole }); // [P2] added id
    } else {
      login(phone, effectiveRole); // AuthContext.login() — id synced via onAuthStateChange
    }

    setLoading(false);

    if (effectiveRole === "worker") {
      navigate(onboardingComplete ? "/worker" : "/worker/onboarding", { replace: true });
    } else {
      navigate("/customer", { replace: true });
    }
  };

  const handleResend = async () => {
    setResendTimer(30);
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
    if (error) {
      setResendTimer(0);
      toast({ title: "Could not resend OTP", description: error.message });
    }
  };

  const maskedPhone = phone ? `••••••${phone.slice(-4)}` : "";

  // ── UI — UNCHANGED ────────────────────────────────────────────────────────
  return (
    <div className="app-shell flex flex-col px-6 py-12">
      <div className="animate-fade-in-up flex flex-col items-center mb-10">
        <h1 className="text-2xl font-bold text-foreground">Verify OTP</h1>
        <p className="text-muted-foreground mt-1">OTP sent to {maskedPhone}</p>
      </div>

      <div className="animate-fade-in-up space-y-6" style={{ animationDelay: "150ms" }}>
        <div className="flex justify-center gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="tel"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className="h-14 w-11 rounded-lg border border-border bg-card text-center text-xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          ))}
        </div>

        <LoadingButton loading={loading} onClick={handleVerify} disabled={otp.join("").length < 6}>
          Verify
        </LoadingButton>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleResend}
            disabled={resendTimer > 0}
            className="text-sm font-medium text-primary disabled:text-muted-foreground touch-target"
          >
            {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground touch-target"
          >
            <ArrowLeft className="h-4 w-4" /> Change phone number
          </button>
        </div>
      </div>
    </div>
  );
}