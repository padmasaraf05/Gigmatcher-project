// src/hooks/usePaymentApi.ts
// PHASE 7: useEnhancedEarnings + useInvoice — real Supabase (unchanged)
// PHASE 12 — Subscriptions + Razorpay:
//   useSubscriptionStatus() — real query, now includes payment history from
//     subscription_payments table.
//   useUpgradeSubscription() — real Razorpay checkout.js flow:
//     1. Loads Razorpay script dynamically
//     2. Opens checkout with test/live key from VITE_RAZORPAY_KEY_ID
//     3. On payment success → INSERT subscriptions row (plan=pro, 30 days)
//     4. INSERT subscription_payments row (audit trail)
//     5. Invalidates subscription cache → UI shows Pro instantly
//   useCancelSubscription() — real UPDATE subscriptions SET status=cancelled
//   useProcessPayment() — still mock (real gateway = Phase 13 FastAPI)
//   usePaymentMethods — still mock (persisted to DB in Phase 13)
//
// PREREQUISITE: run phase12_prerequisites.sql in Supabase SQL Editor first.
//   Renames plan_type→plan, adds subscription_payments table, RLS policies.
//
// RAZORPAY SETUP:
//   1. Create account at https://dashboard.razorpay.com
//   2. Get test key: Settings → API Keys → Key ID (starts with rzp_test_)
//   3. Add to .env: VITE_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_HERE
//   4. Test UPI ID: success@razorpay
//   5. Test card: 4111 1111 1111 1111, any future date, any CVV

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnhancedTransaction {
  id: string;
  serviceIcon: string;
  customerName: string;
  serviceType: string;
  date: string;
  grossAmount: number;
  netAmount: number;
  status: string;
}

export interface EnhancedEarningsData {
  total: number;
  grossEarnings: number;
  commission: number;
  netPayout: number;
  jobsCompleted: number;
  isUp: boolean;
  percentChange: number;
  chartData: { day: string; amount: number; average: number }[];
  transactions: EnhancedTransaction[];
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  workerName: string;
  workerPhone: string;
  customerName: string;
  customerPhone: string;
  serviceDescription: string;
  hours: number;
  rate: number;
  subtotal: number;
  grossAmount: number;
  commission: number;
  netAmount: number;
  paymentMethod: string;
  transactionId: string;
}

type Period = "today" | "week" | "month" | "custom";

// ─── Period date range helpers ────────────────────────────────────────────────

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  if (period === "today") {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (period === "week") {
    const from = new Date(now);
    const day = from.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    from.setDate(from.getDate() + diff); from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }
  if (period === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: now };
  }
  const from = new Date(now); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);
  return { from, to: now };
}

function getPreviousPeriodRange(period: Period): { from: Date; to: Date } {
  const { from, to } = getPeriodRange(period);
  const ms = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - ms), to: new Date(from.getTime()) };
}

function buildChartBuckets(
  period: Period,
  range: { from: Date; to: Date }
): { labels: string[]; getKey: (d: Date) => string } {
  if (period === "today") return { labels: ["Today"], getKey: () => "Today" };
  if (period === "week") {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return { labels, getKey: (d) => { const day = d.getDay(); return labels[day === 0 ? 6 : day - 1]; } };
  }
  if (period === "month") {
    const days = new Date(range.from.getFullYear(), range.from.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: days }, (_, i) => `${i + 1}`);
    return { labels, getKey: (d) => `${d.getDate()}` };
  }
  const labels: string[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    labels.push(cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
    cursor.setDate(cursor.getDate() + 1);
  }
  return { labels, getKey: (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
}

const SERVICE_ICON: Record<string, string> = {
  Plumber: "🔧", Electrician: "⚡", Carpenter: "🪚", Tailor: "🧵",
  Mechanic: "🔩", Painter: "🎨", Mason: "🧱", Welder: "🔥",
  "AC Technician": "❄️", "Appliance Repair": "🛠️", Gardener: "🌿", Cleaner: "🧹",
};

// ─── Real: Enhanced Earnings (Phase 7 — unchanged) ───────────────────────────

export function useEnhancedEarnings(period: Period) {
  return useQuery<EnhancedEarningsData>({
    queryKey: ["worker", "earnings", "enhanced", period],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const range     = getPeriodRange(period);
      const prevRange = getPreviousPeriodRange(period);

      const { data: rows, error } = await supabase
        .from("earnings")
        .select(`
          id, gross_amount, commission_amount, payout_amount, status, created_at,
          jobs (
            description,
            service_categories ( name ),
            profiles!customer_id ( full_name, phone )
          )
        `)
        .eq("worker_id", uid)
        .gte("created_at", range.from.toISOString())
        .lte("created_at", range.to.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      const currentRows = rows ?? [];

      const { data: prevRows } = await supabase
        .from("earnings").select("payout_amount").eq("worker_id", uid)
        .gte("created_at", prevRange.from.toISOString())
        .lte("created_at", prevRange.to.toISOString());

      const prevTotal = (prevRows ?? []).reduce((s, r) => s + (r.payout_amount ?? 0), 0);

      let grossEarnings = 0, commissionTotal = 0, netPayout = 0;
      for (const r of currentRows) {
        grossEarnings   += r.gross_amount      ?? 0;
        commissionTotal += r.commission_amount ?? 0;
        netPayout       += r.payout_amount     ?? 0;
      }

      let percentChange = 0, isUp = true;
      if (prevTotal > 0) {
        percentChange = Math.round(((netPayout - prevTotal) / prevTotal) * 100);
        isUp = percentChange >= 0;
      }

      const { labels, getKey } = buildChartBuckets(period, range);
      const buckets: Record<string, number> = {};
      labels.forEach((l) => (buckets[l] = 0));
      for (const r of currentRows) {
        const key = getKey(new Date(r.created_at));
        if (key in buckets) buckets[key] += r.payout_amount ?? 0;
      }
      const amounts = labels.map((l) => buckets[l]);
      const avg = amounts.length > 0 ? Math.round(amounts.reduce((s, v) => s + v, 0) / amounts.length) : 0;
      const chartData = labels.map((day) => ({ day, amount: Math.round(buckets[day]), average: avg }));

      const transactions: EnhancedTransaction[] = currentRows.map((r) => {
        const job      = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs;
        const cat      = job ? (Array.isArray(job.service_categories) ? job.service_categories[0] : job.service_categories) : null;
        const customer = job ? (Array.isArray(job.profiles) ? job.profiles[0] : job.profiles) : null;
        const serviceType  = (cat as { name?: string } | null)?.name ?? "Service";
        const customerName = (customer as { full_name?: string } | null)?.full_name ?? "Customer";
        const createdAt = new Date(r.created_at);
        return {
          id: r.id, serviceIcon: SERVICE_ICON[serviceType] ?? "💼", customerName, serviceType,
          date: createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          grossAmount: Math.round(r.gross_amount ?? 0),
          netAmount:   Math.round(r.payout_amount ?? 0),
          status:      r.status ?? "paid",
        };
      });

      return {
        total: Math.round(netPayout), grossEarnings: Math.round(grossEarnings),
        commission: Math.round(commissionTotal), netPayout: Math.round(netPayout),
        jobsCompleted: currentRows.length, isUp, percentChange: Math.abs(percentChange),
        chartData, transactions,
      };
    },
    refetchInterval: 60000,
  });
}

// ─── Real: Invoice detail (Phase 7 — unchanged) ───────────────────────────────

export function useInvoice(earningsId: string) {
  return useQuery<InvoiceData>({
    queryKey: ["worker", "invoice", earningsId],
    enabled: !!earningsId,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { data: row, error } = await supabase
        .from("earnings")
        .select(`
          id, gross_amount, commission_amount, payout_amount, status, created_at,
          jobs (
            description, final_price, estimated_price,
            service_categories ( name ),
            profiles!customer_id ( full_name, phone )
          )
        `)
        .eq("id", earningsId).eq("worker_id", uid).single();

      if (error) throw new Error(error.message);

      const job      = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      const cat      = job ? (Array.isArray(job.service_categories) ? job.service_categories[0] : job.service_categories) : null;
      const customer = job ? (Array.isArray(job.profiles) ? job.profiles[0] : job.profiles) : null;

      const { data: workerProfile } = await supabase
        .from("profiles").select("full_name, phone, worker_profiles(hourly_rate)").eq("id", uid).single();

      const wp = workerProfile ? (Array.isArray(workerProfile.worker_profiles) ? workerProfile.worker_profiles[0] : workerProfile.worker_profiles) : null;
      const hourlyRate  = (wp as { hourly_rate?: number } | null)?.hourly_rate ?? 0;
      const grossAmount = row.gross_amount ?? 0;
      const hours       = hourlyRate > 0 ? Math.max(1, Math.round((grossAmount / hourlyRate) * 10) / 10) : 1;
      const rate        = hourlyRate > 0 ? hourlyRate : grossAmount;
      const serviceType = (cat as { name?: string } | null)?.name ?? "Service";

      return {
        invoiceNumber: `GM-${row.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        date: new Date(row.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        workerName:    workerProfile?.full_name ?? "Worker",
        workerPhone:   workerProfile?.phone     ?? "—",
        customerName:  (customer as { full_name?: string } | null)?.full_name ?? "Customer",
        customerPhone: (customer as { phone?: string }     | null)?.phone     ?? "—",
        serviceDescription: job?.description ? `${serviceType} — ${job.description}` : serviceType,
        hours, rate: Math.round(rate), subtotal: Math.round(grossAmount),
        grossAmount: Math.round(grossAmount),
        commission:  Math.round(row.commission_amount ?? grossAmount * 0.1),
        netAmount:   Math.round(row.payout_amount     ?? grossAmount * 0.9),
        paymentMethod: "Cash",
        transactionId: row.id.slice(0, 13).toUpperCase(),
      };
    },
  });
}

// ─── Static data ──────────────────────────────────────────────────────────────

export const PRO_BENEFITS = [
  "Priority matching — appear first in search results",
  "Verified Pro badge on your profile",
  "Access to premium customers & higher-value jobs",
  "Advanced earnings analytics & PDF reports",
  "Dedicated support with faster response times",
];

export const PLAN_COMPARISON: { feature: string; free: boolean | string; pro: boolean | string }[] = [
  { feature: "Job matching",       free: true,       pro: true },
  { feature: "Profile visibility", free: "Standard", pro: "Priority" },
  { feature: "Pro badge",          free: false,       pro: true },
  { feature: "Analytics",          free: "Basic",    pro: "Advanced" },
  { feature: "PDF reports",        free: false,       pro: true },
  { feature: "Premium customers",  free: false,       pro: true },
  { feature: "Support",            free: "Standard", pro: "Priority" },
];

// ─── Types — Subscription ─────────────────────────────────────────────────────

export interface SubscriptionPayment {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "failed";
}

export interface SubscriptionStatus {
  plan: "free" | "pro";
  renewalDate: string | null;
  status: "active" | "cancelled" | "expired" | null;
  paymentHistory: SubscriptionPayment[];
}

// ─── Real: useSubscriptionStatus ─────────────────────────────────────────────
// Phase 12: now includes real payment history from subscription_payments table.

export function useSubscriptionStatus() {
  return useQuery<SubscriptionStatus>({
    queryKey: ["worker", "subscription"],
    queryFn: async (): Promise<SubscriptionStatus> => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return { plan: "free", renewalDate: null, status: null, paymentHistory: [] };

      // Run expiry cleanup
      await supabase.rpc("expire_subscriptions");

      // Fetch active subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, plan, status, end_date")
        .eq("worker_id", uid)
        .eq("status", "active")
        .maybeSingle();

      if (!sub) return { plan: "free", renewalDate: null, status: null, paymentHistory: [] };

      // Fetch payment history for this subscription
      const { data: payments } = await supabase
        .from("subscription_payments")
        .select("id, amount, status, created_at")
        .eq("subscription_id", sub.id)
        .order("created_at", { ascending: false });

      const paymentHistory: SubscriptionPayment[] = (payments ?? []).map((p) => ({
        id:     p.id,
        date:   new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        amount: p.amount,
        status: p.status as "paid" | "failed",
      }));

      return {
        plan:        sub.plan === "pro" ? "pro" : "free",
        renewalDate: sub.end_date
          ? new Date(sub.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : null,
        status:      sub.status as SubscriptionStatus["status"],
        paymentHistory,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Razorpay script loader ───────────────────────────────────────────────────

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-sdk")) { resolve(true); return; }
    const script = document.createElement("script");
    script.id  = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── Real: useUpgradeSubscription ────────────────────────────────────────────
// Phase 12: Opens Razorpay checkout. On success:
//   1. Cancels any existing subscription
//   2. INSERTs new subscriptions row (plan=pro, 30 days)
//   3. INSERTs subscription_payments row (audit trail)
//   4. Invalidates cache → UI reflects Pro status instantly
//
// SETUP REQUIRED:
//   Add VITE_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY to your .env file
//   Get key from: https://dashboard.razorpay.com → Settings → API Keys

export function useUpgradeSubscription() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (method: string): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load Razorpay. Check your internet connection.");

      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
      if (!keyId) throw new Error("VITE_RAZORPAY_KEY_ID not set in .env");

      // Fetch worker name for prefill
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", uid)
        .single();

      // Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) { reject(new Error("Razorpay not available")); return; }

        const options = {
          key:         keyId,
          amount:      9900,        // ₹99 in paise
          currency:    "INR",
          name:        "GigMatcher",
          description: "Pro Subscription — 1 Month",
          image:       "/icon-192.png",
          prefill: {
            name:    profile?.full_name ?? "",
            contact: profile?.phone ?? "",
          },
          theme:   { color: "#2563EB" },
          method:  method === "UPI" ? { upi: true, card: false, netbanking: false } : undefined,

          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id?: string;
          }) => {
            try {
              // Cancel any existing active subscription
              await supabase
                .from("subscriptions")
                .update({ status: "cancelled" })
                .eq("worker_id", uid)
                .eq("status", "active");

              const now      = new Date();
              const endDate  = new Date(now);
              endDate.setDate(endDate.getDate() + 30); // 30-day subscription

              // Insert new subscription
              const { data: newSub, error: subErr } = await supabase
                .from("subscriptions")
                .insert({
                  worker_id:           uid,
                  plan:                "pro",
                  status:              "active",
                  start_date:          now.toISOString(),
                  end_date:            endDate.toISOString(),
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id:   response.razorpay_order_id ?? null,
                  payment_method:      method,
                })
                .select("id")
                .single();

              if (subErr) { reject(new Error(subErr.message)); return; }

              // Insert payment record
              await supabase
                .from("subscription_payments")
                .insert({
                  subscription_id:     newSub.id,
                  worker_id:           uid,
                  amount:              99,
                  currency:            "INR",
                  status:              "paid",
                  payment_method:      method,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id:   response.razorpay_order_id ?? null,
                });

              resolve();
            } catch (e) {
              reject(e);
            }
          },

          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        };

        const rzp = new Razorpay(options);
        rzp.on("payment.failed", (resp: { error: { description: string } }) => {
          reject(new Error(resp.error.description ?? "Payment failed"));
        });
        rzp.open();
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["worker", "subscription"] });
    },
    onError: (err: Error) => {
      // Don't toast "Payment cancelled" — user dismissed intentionally
      if (err.message !== "Payment cancelled") {
        toast({ title: "Upgrade failed", description: err.message });
      }
    },
  });
}

// ─── Real: useCancelSubscription ─────────────────────────────────────────────
// Phase 12: Real UPDATE — sets status=cancelled. Worker retains Pro until end_date.

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("worker_id", uid)
        .eq("status", "active");

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["worker", "subscription"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not cancel subscription", description: err.message });
    },
  });
}

// ─── Real: useProcessPayment ──────────────────────────────────────────────────
// Phase 12b: Real Razorpay checkout for customer booking payments.
//
// Flow:
//   1. Fetches job to get total amount (estimated_price + platform_fee)
//   2. Opens Razorpay checkout
//   3. On success → UPDATE jobs SET payment_status='paid', razorpay_payment_id
//   4. Invalidates booking cache → PaymentInfoCard shows "paid" instantly
//
// The earnings row is created automatically by the DB trigger
// trg_create_earnings_on_completion when job status → 'completed'.

export function useProcessPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, method }: { bookingId: string; method: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // Fetch job details for amount + customer info
      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .select("estimated_price, final_price, platform_fee, profiles!customer_id(full_name, phone)")
        .eq("id", bookingId)
        .single();

      if (jobErr || !job) throw new Error("Booking not found");

      const serviceCharge = job.final_price ?? job.estimated_price ?? 0;
      const platformFee   = (job as { platform_fee?: number }).platform_fee ?? 20;
      const total         = serviceCharge + platformFee;
      const totalPaise    = Math.round(total * 100);

      const customer = Array.isArray(job.profiles) ? job.profiles[0] : job.profiles;

      // Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load Razorpay. Check your internet connection.");

      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
      if (!keyId) throw new Error("VITE_RAZORPAY_KEY_ID not set in .env");

      // Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) { reject(new Error("Razorpay not available")); return; }

        const options = {
          key:         keyId,
          amount:      totalPaise,
          currency:    "INR",
          name:        "GigMatcher",
          description: "Service Payment",
          image:       "/icon-192.png",
          prefill: {
            name:    (customer as { full_name?: string } | null)?.full_name ?? "",
            contact: (customer as { phone?: string } | null)?.phone ?? "",
          },
          theme: { color: "#2563EB" },
          method: method === "UPI"
            ? { upi: true, card: false, netbanking: false }
            : { upi: false, card: true, netbanking: true },

          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id?: string;
          }) => {
            try {
              // Mark job as paid in DB
              const { error: updateErr } = await supabase
                .from("jobs")
                .update({
                  payment_status:      "paid",
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id:   response.razorpay_order_id ?? null,
                })
                .eq("id", bookingId);

              if (updateErr) { reject(new Error(updateErr.message)); return; }
              resolve();
            } catch (e) { reject(e); }
          },

          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = (new Razorpay(options) as any);
        rzp.on("payment.failed", (resp: { error: { description: string } }) => {
          reject(new Error(resp.error.description ?? "Payment failed"));
        });
        rzp.open();
      });

      return { bookingId, method };
    },
    onSuccess: (_, { bookingId }) => {
      void qc.invalidateQueries({ queryKey: ["customer", "booking", bookingId] });
      void qc.invalidateQueries({ queryKey: ["customer"] });
    },
    onError: (err: Error) => {
      if (err.message !== "Payment cancelled") {
        toast({ title: "Payment failed", description: err.message });
      }
    },
  });
}

// ─── Types — Payment methods ──────────────────────────────────────────────────

export interface PaymentMethod {
  id: string;
  type: "upi" | "card";
  label: string;
  identifier: string;
  isDefault: boolean;
}

// ─── Real: usePaymentMethods ──────────────────────────────────────────────────
// Phase 12b: Reads from payment_methods table (created in phase12b_prerequisites.sql)

export function usePaymentMethods() {
  return useQuery<PaymentMethod[]>({
    queryKey: ["paymentMethods"],
    queryFn: async (): Promise<PaymentMethod[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return [];

      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, type, label, identifier, is_default")
        .eq("user_id", uid)
        .order("is_default", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []).map((m) => ({
        id:         m.id,
        type:       m.type as "upi" | "card",
        label:      m.label,
        identifier: m.identifier,
        isDefault:  m.is_default,
      }));
    },
  });
}

// ─── Real: useAddPaymentMethod ────────────────────────────────────────────────

export function useAddPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, identifier }: { type: "upi" | "card"; identifier: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // Check if this is the first method — make it default
      const { count } = await supabase
        .from("payment_methods")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);

      const isFirst = (count ?? 0) === 0;

      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          user_id:    uid,
          type,
          label:      type === "upi" ? "UPI" : "Debit Card",
          identifier,
          is_default: isFirst,
        })
        .select("id, type, label, identifier, is_default")
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["paymentMethods"] }),
    onError:   (err: Error) => toast({ title: "Could not add payment method", description: err.message }),
  });
}

// ─── Real: useDeletePaymentMethod ────────────────────────────────────────────

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // Check if deleting default — promote next one if so
      const { data: toDelete } = await supabase
        .from("payment_methods")
        .select("is_default")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);

      // If deleted method was default, promote the first remaining
      if (toDelete?.is_default) {
        const { data: remaining } = await supabase
          .from("payment_methods")
          .select("id")
          .eq("user_id", uid)
          .limit(1);
        if (remaining && remaining.length > 0) {
          await supabase
            .from("payment_methods")
            .update({ is_default: true })
            .eq("id", remaining[0].id);
        }
      }
      return id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["paymentMethods"] }),
    onError:   (err: Error) => toast({ title: "Could not remove payment method", description: err.message }),
  });
}

// ─── Real: useSetDefaultPaymentMethod ────────────────────────────────────────

export function useSetDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // Clear existing default
      await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", uid);

      // Set new default
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["paymentMethods"] }),
    onError:   (err: Error) => toast({ title: "Could not update default", description: err.message }),
  });
}