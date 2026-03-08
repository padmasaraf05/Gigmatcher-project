// src/context/AuthContext.tsx
// BUGFIX (Phase 3): localStorage is now only used as cache if the stored
// user object has a valid non-empty `id` field. Pre-Phase-2 objects (no id)
// are discarded on init so we always wait for the real Supabase session.
// This fixes:
//   - Dashboard showing "Worker" instead of real name
//   - Availability toggle firing with empty user.id (hitting 0 DB rows)

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserRole, LanguageCode, User } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  language: LanguageCode;
  isAuthenticated: boolean;
  isOnline: boolean;
  login: (phone: string, role: UserRole) => void;
  register: (user: User) => void;
  logout: () => void;
  setLanguage: (lang: LanguageCode) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── helpers ───────────────────────────────────────────────────────────────────

const isValidRole = (r: unknown): r is UserRole =>
  r === "worker" || r === "customer";

const isValidLanguage = (l: unknown): l is LanguageCode =>
  l === "en" || l === "hi" || l === "ta" || l === "te" || l === "mr";

function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

// [BUGFIX] Only restore from localStorage if the stored object has a real id.
// Pre-Phase-2 objects have no id field → discard them and wait for Supabase session.
function loadUserFromStorage(): User | null {
  try {
    const raw = localStorage.getItem("gm_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    // Must have a non-empty id to be considered a valid Phase-2+ object
    if (!parsed.id || typeof parsed.id !== "string" || parsed.id.trim() === "") {
      localStorage.removeItem("gm_user"); // discard stale pre-Phase-2 object
      return null;
    }
    return parsed as User;
  } catch {
    return null;
  }
}

// ── provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // [BUGFIX] Uses loadUserFromStorage() instead of raw JSON.parse —
  // discards any cached user without a valid id.
  const [user, setUser] = useState<User | null>(loadUserFromStorage);

  const [language, setLang] = useState<LanguageCode>(() => {
    return (localStorage.getItem("gm_lang") as LanguageCode) || "en";
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── fetch profile from DB and sync state ──────────────────────────────────

  const fetchAndSyncProfile = async (supabaseUserId: string): Promise<void> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, phone, language")
      .eq("id", supabaseUserId)
      .single();

    if (error || !data) {
      // Profile row doesn't exist yet (new user mid-registration).
      return;
    }

    const finalLanguage: LanguageCode = isValidLanguage(data.language)
      ? data.language
      : language;

    const nextUser: User = {
      id: data.id,
      phone: normalizePhone(data.phone) ?? "",
      name: data.full_name ?? undefined,
      role: isValidRole(data.role) ? data.role : "customer",
      language: finalLanguage,
    };

    setUser(nextUser);
    setLang(finalLanguage);
    localStorage.setItem("gm_user", JSON.stringify(nextUser));
    localStorage.setItem("gm_lang", finalLanguage);
  };

  const refreshUser = async (): Promise<void> => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      await fetchAndSyncProfile(data.session.user.id);
    }
  };

  // ── auth state listener ───────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user?.id) {
        void fetchAndSyncProfile(data.session.user.id);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user?.id) {
        void fetchAndSyncProfile(session.user.id);
      } else {
        setUser(null);
        localStorage.removeItem("gm_user");
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── online status ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── public API ────────────────────────────────────────────────────────────

  const login = (phone: string, role: UserRole) => {
    // Only set optimistic state if we don't already have a real user loaded.
    // If user is already set (from localStorage with valid id or from DB sync),
    // do nothing — onAuthStateChange will update correctly.
    if (user?.id) return;
    // No optimistic set with empty id — wait for onAuthStateChange instead.
    // This prevents the empty-id race condition.
  };

  const register = (u: User) => {
    // Only persist if the user object has a real id
    if (!u.id || u.id.trim() === "") return;
    setUser(u);
    localStorage.setItem("gm_user", JSON.stringify(u));
  };

  const logout = () => {
    void supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("gm_user");
  };

  const setLanguage = (lang: LanguageCode) => {
    setLang(lang);
    localStorage.setItem("gm_lang", lang);
    if (user?.id) {
      void supabase
        .from("profiles")
        .update({ language: lang })
        .eq("id", user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        language,
        isAuthenticated: !!user,
        isOnline,
        login,
        register,
        logout,
        setLanguage,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}