// src/lib/types.ts
// PHASE 2: Added `id` (Supabase UUID) and `onboarding_complete` to User.
// All other types preserved exactly as before.

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export type UserRole = "worker" | "customer";

export interface User {
  id: string;           // Supabase auth UUID — added Phase 2
  phone: string;
  name?: string;
  role: UserRole;
  language: LanguageCode;
  onboarding_complete?: boolean; // Phase 2: used to route new workers → onboarding
}