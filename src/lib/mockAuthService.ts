// src/lib/mockAuthService.ts
// PHASE 2: Full replacement — all mock logic removed.
// All functions now call real Supabase auth endpoints.
// The file name is kept as-is to avoid breaking existing imports.

import { supabase } from "@/lib/supabase";
import { UserRole, LanguageCode } from "./types";

export const mockAuthService = {
  /**
   * Send OTP to phone number via Supabase Phone Auth.
   * On localhost Supabase uses a test OTP (check your Supabase dashboard
   * Auth → Users, or use 123456 if you enabled test OTPs in project settings).
   */
  async sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
    // Supabase expects E.164 format: +91XXXXXXXXXX
    const formatted = phone.startsWith("+") ? phone : `+91${phone}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Verify OTP entered by user.
   * Returns the Supabase user UUID on success.
   */
  async verifyOTP(
    phone: string,
    otp: string
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    const formatted = phone.startsWith("+") ? phone : `+91${phone}`;
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: "sms",
    });
    if (error || !data.user) {
      return { success: false, error: error?.message ?? "OTP verification failed" };
    }
    return { success: true, userId: data.user.id };
  },

  /**
   * Register: upsert the profiles row after OTP verification.
   * Called from VerifyOtpPage after a successful verifyOTP for new users.
   * Returns the role so the caller can route correctly.
   */
  async register(data: {
    name: string;
    phone: string;
    role: UserRole;
    language: LanguageCode;
    userId: string; // Supabase auth UUID
  }): Promise<{ success: boolean; role: UserRole; error?: string }> {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: data.userId,
        full_name: data.name,
        phone: data.phone.replace(/\D/g, "").slice(-10), // store last 10 digits
        role: data.role,
        language: data.language,
      },
      { onConflict: "id" }
    );

    if (error) return { success: false, role: data.role, error: error.message };
    return { success: true, role: data.role };
  },
};

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
] as const;