// src/hooks/useWorkerApi.ts
// BUG FIX:
//   Bug #2 — JOB_SELECT FK hint changed from jobs_customer_id_fkey constraint
//     name to column name hint (profiles!customer_id) for reliable join.
//   Bug #3 — useWorkerJobs("pending") now queries jobs WHERE worker_id = uid
//     AND status = 'pending' (direct assignment). Previously used RPC which
//     returned ALL unassigned jobs — now only returns jobs explicitly assigned
//     to this worker by a customer who clicked "Book Now".
//   Bug #3 — useUpdateJobStatus maps "declined" → DB status "cancelled" so
//     rejected jobs surface in the customer's Cancelled bookings tab.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerStats {
  todayEarnings: number;
  weekEarnings: number;
  activeJobs: number;
  rating: number;
}

export interface Job {
  id: string;
  customerName: string;
  customerPhoto: string;
  serviceType: string;
  distance: string;
  payment: number;
  status: "pending" | "active" | "en_route" | "in_progress" | "completed";
  urgency: "normal" | "urgent" | "scheduled";
  description: string;
  address: string;
  phone: string;
  customerRating: number;
  toolsRequired: string[];
  postedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  jobType: string;
  customerName: string;
  amount: number;
  status: "paid" | "pending" | "processing";
}

export interface EarningsData {
  total: number;
  chartData: { day: string; amount: number }[];
  transactions: Transaction[];
}

export interface WorkerProfileData {
  id: string;
  name: string;
  phone: string;
  language: string;
  profile_photo_url: string | null;
  rating: number;
  total_reviews: number;
  is_available: boolean;
  is_pro: boolean;
  service_radius_km: number | null;
  hourly_rate: number | null;
  availability_days: boolean[] | null;
  skills: { category_id: string; category_name: string; experience_level: string | null }[];
  tools: { id: string; tool_name: string }[];
}

// ─── Helper — format relative time ───────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

// ─── Helper — map raw DB job row → Job type ───────────────────────────────────

function mapJobRow(j: {
  id: string;
  description?: string | null;
  status: string;
  urgency?: string | null;
  address?: string | null;
  estimated_price?: number | null;
  final_price?: number | null;
  required_tools?: string[] | null;
  created_at: string;
  worker_id?: string | null;
  profiles?: { full_name?: string | null; phone?: string | null; profile_photo_url?: string | null } | { full_name?: string | null; phone?: string | null; profile_photo_url?: string | null }[] | null;
  service_categories?: { name?: string | null } | { name?: string | null }[] | null;
  reviews?: { rating: number; reviewer_id: string }[] | null;
}): Job {
  const cust = Array.isArray(j.profiles) ? j.profiles[0] : j.profiles;
  const cat  = Array.isArray(j.service_categories) ? j.service_categories[0] : j.service_categories;

  // [PHASE 8] Find the review the worker submitted for this job.
  // reviewer_id = worker_id means the worker rated the customer.
  const reviewsArr = Array.isArray(j.reviews) ? j.reviews : [];
  const workerReview = j.worker_id
    ? reviewsArr.find((r) => r.reviewer_id === j.worker_id)
    : undefined;
  const customerRating = workerReview?.rating ?? 0;

  // Map DB status → Job["status"]
  let status: Job["status"] = "pending";
  if (j.status === "accepted")    status = "active";
  else if (j.status === "en_route")    status = "en_route";
  else if (j.status === "in_progress") status = "in_progress";
  else if (j.status === "completed")   status = "completed";

  // Map urgency
  let urgency: Job["urgency"] = "normal";
  if (j.urgency === "urgent")    urgency = "urgent";
  else if (j.urgency === "scheduled") urgency = "scheduled";

  return {
    id: j.id,
    // [FIX Bug #2] full_name now reliably populated via profiles!customer_id join
    customerName:  (cust as { full_name?: string | null } | null)?.full_name ?? "Customer",
    customerPhoto: (cust as { profile_photo_url?: string | null } | null)?.profile_photo_url ?? "",
    serviceType:   (cat  as { name?: string | null } | null)?.name ?? "Service",
    distance:  "—",
    payment:   j.final_price ?? j.estimated_price ?? 0,
    status,
    urgency,
    description: j.description ?? "",
    address:     j.address     ?? "",
    phone:       (cust as { phone?: string | null } | null)?.phone ?? "",
    customerRating: customerRating,
    toolsRequired:  (j.required_tools as string[] | null) ?? [],
    postedAt:       relativeTime(j.created_at),
  };
}

// [FIX Bug #2] Column-name FK hint (profiles!customer_id) is unambiguous even
// when jobs has two FK columns pointing at profiles (customer_id + worker_id).
// [PHASE 8] Added worker_id + reviews so customerRating is populated from
// the review the worker submitted for this specific job.
const JOB_SELECT = `
  id, description, status, urgency, address,
  estimated_price, final_price, required_tools, created_at,
  worker_id,
  profiles!customer_id(full_name, phone, profile_photo_url),
  service_categories(name),
  reviews(rating, reviewer_id)
`;

// ─── Real: Worker Dashboard ───────────────────────────────────────────────────

export function useWorkerDashboard() {
  return useQuery<{
    stats: WorkerStats;
    activeJobs: Job[];
    demandAlert: string;
    workerName: string;
    workerPhoto: string | null;
    isAvailable: boolean;
  }>({
    queryKey: ["worker", "dashboard"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("full_name, profile_photo_url, worker_profiles(rating, is_available)")
        .eq("id", uid)
        .single();
      if (profileErr) throw profileErr;

      const wp = Array.isArray(profile.worker_profiles)
        ? profile.worker_profiles[0]
        : profile.worker_profiles;

      const { count: activeCount } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("worker_id", uid)
        .in("status", ["accepted", "en_route", "in_progress"]);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todayRows } = await supabase
        .from("earnings")
        .select("payout_amount")
        .eq("worker_id", uid)
        .gte("created_at", todayStart.toISOString());
      const todayEarnings = (todayRows ?? []).reduce((s, r) => s + (r.payout_amount ?? 0), 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const { data: weekRows } = await supabase
        .from("earnings")
        .select("payout_amount")
        .eq("worker_id", uid)
        .gte("created_at", weekStart.toISOString());
      const weekEarnings = (weekRows ?? []).reduce((s, r) => s + (r.payout_amount ?? 0), 0);

      const { data: jobRows } = await supabase
        .from("jobs")
        .select(JOB_SELECT)
        .eq("worker_id", uid)
        .in("status", ["accepted", "en_route", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(5);

      const activeJobs: Job[] = (jobRows ?? []).map(mapJobRow);

      // PHASE 14 PATCH for useWorkerApi.ts
// 
// In useWorkerDashboard() queryFn, find this block:
//
//   const { data: preds } = await supabase
//     .from("demand_predictions")
//     ...
//   let demandAlert = "";
//   if (preds && preds.length > 0) { ... }
//
// Replace it entirely with this:

      // PHASE 14: FastAPI /demand-summary → richer alert with demand score + job count.
      // Falls back to direct Supabase query if VITE_MATCHING_API_URL not set.
      let demandAlert = "";
      const matchingApiUrl = (import.meta.env.VITE_MATCHING_API_URL as string | undefined)
        ?.replace(/\/$/, "");

      if (matchingApiUrl) {
        try {
          const demandRes = await fetch(`${matchingApiUrl}/demand-summary`);
          if (demandRes.ok) {
            const demandData = await demandRes.json() as { alert?: string };
            demandAlert = demandData.alert ?? "";
          }
        } catch {
          // Silent fallback to Supabase below
        }
      }

      // Supabase fallback (or if FastAPI returns empty alert)
      if (!demandAlert) {
        const { data: preds } = await supabase
          .from("demand_predictions")
          .select("area_name, predicted_demand_score, service_categories(name)")
          .order("predicted_demand_score", { ascending: false })
          .limit(1);

        if (preds && preds.length > 0) {
          const p = preds[0];
          const catName = Array.isArray(p.service_categories)
            ? (p.service_categories[0] as { name?: string })?.name
            : (p.service_categories as { name?: string } | null)?.name;
          const score = p.predicted_demand_score ?? 0;
          const level = score >= 80 ? "🔥 Very high" : score >= 50 ? "📈 High" : "📊 Moderate";
          demandAlert = catName
            ? `${level} demand for ${catName} in ${p.area_name ?? "your area"}!`
            : "";
        }
      }

      return {
        stats: {
          todayEarnings,
          weekEarnings,
          activeJobs: activeCount ?? 0,
          rating: (wp as { rating?: number } | null)?.rating ?? 0,
        },
        activeJobs,
        demandAlert,
        workerName:  profile.full_name ?? "",
        workerPhoto: profile.profile_photo_url ?? null,
        isAvailable: (wp as { is_available?: boolean } | null)?.is_available ?? false,
      };
    },
    refetchInterval: 30000,
  });
}

// ─── Real: Availability toggle ────────────────────────────────────────────────

export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("worker_profiles")
        .upsert({ user_id: uid, is_available: isAvailable }, { onConflict: "user_id" });
      if (error) throw error;
      return isAvailable;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["worker", "dashboard"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update availability", description: err.message });
    },
  });
}

// ─── Real: Full worker profile ────────────────────────────────────────────────

export function useWorkerProfile() {
  return useQuery<WorkerProfileData>({
    queryKey: ["worker", "profile"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, phone, language, profile_photo_url")
        .eq("id", uid)
        .single();
      if (pErr) throw pErr;

      const { data: wp } = await supabase
        .from("worker_profiles")
        .select("rating, total_reviews, is_available, is_pro, service_radius_km, hourly_rate, availability_days")
        .eq("user_id", uid)
        .maybeSingle();

      const { data: skillRows } = await supabase
        .from("worker_skills")
        .select("category_id, experience_level, service_categories(name)")
        .eq("worker_id", uid);

      const skills = (skillRows ?? []).map((s) => {
        const cat = Array.isArray(s.service_categories) ? s.service_categories[0] : s.service_categories;
        return {
          category_id: s.category_id,
          category_name: (cat as { name?: string } | null)?.name ?? "",
          experience_level: s.experience_level ?? null,
        };
      });

      const { data: toolRows } = await supabase
        .from("worker_tools")
        .select("id, tool_name")
        .eq("worker_id", uid);

      return {
        id: p.id,
        name: p.full_name ?? "",
        phone: p.phone ?? "",
        language: p.language ?? "en",
        profile_photo_url: p.profile_photo_url ?? null,
        rating: (wp as { rating?: number } | null)?.rating ?? 0,
        total_reviews: (wp as { total_reviews?: number } | null)?.total_reviews ?? 0,
        is_available: (wp as { is_available?: boolean } | null)?.is_available ?? false,
        is_pro: (wp as { is_pro?: boolean } | null)?.is_pro ?? false,
        service_radius_km: (wp as { service_radius_km?: number } | null)?.service_radius_km ?? null,
        hourly_rate: (wp as { hourly_rate?: number } | null)?.hourly_rate ?? null,
        availability_days: (wp as { availability_days?: boolean[] } | null)?.availability_days ?? null,
        skills,
        tools: (toolRows ?? []).map((t) => ({ id: t.id, tool_name: t.tool_name })),
      };
    },
  });
}

// ─── Real: Update worker profile ──────────────────────────────────────────────

export function useUpdateWorkerProfile() {
  const { refreshUser } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fullName?: string;
      language?: string;
      service_radius_km?: number;
      latitude?: number | null;
      longitude?: number | null;
      hourly_rate?: number;
      availability_days?: boolean[];
      skills?: { name: string; experience_level?: string }[];
      tools?: string[];
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      if (input.fullName !== undefined || input.language !== undefined) {
        await supabase.from("profiles").update({
          ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
          ...(input.language !== undefined ? { language: input.language }  : {}),
        }).eq("id", uid);
      }

      const wpUpdate: Record<string, unknown> = {};
      if (input.service_radius_km !== undefined) wpUpdate.service_radius_km = input.service_radius_km;
      if (input.latitude          !== undefined) wpUpdate.latitude           = input.latitude;
      if (input.longitude         !== undefined) wpUpdate.longitude          = input.longitude;
      if (input.hourly_rate       !== undefined) wpUpdate.hourly_rate        = input.hourly_rate;
      if (input.availability_days !== undefined) wpUpdate.availability_days  = input.availability_days;
      if (Object.keys(wpUpdate).length > 0) {
        await supabase.from("worker_profiles").update(wpUpdate).eq("user_id", uid);
      }

      if (input.skills !== undefined) {
        const { data: cats } = await supabase
          .from("service_categories").select("id, name").in("name", input.skills.map((s) => s.name));
        const catMap = new Map((cats ?? []).map((c) => [c.name, c.id]));
        await supabase.from("worker_skills").delete().eq("worker_id", uid);
        const inserts = input.skills.filter((s) => catMap.has(s.name)).map((s) => ({
          worker_id: uid, category_id: catMap.get(s.name)!, experience_level: s.experience_level ?? null,
        }));
        if (inserts.length > 0) await supabase.from("worker_skills").insert(inserts);
      }

      if (input.tools !== undefined) {
        await supabase.from("worker_tools").delete().eq("worker_id", uid);
        if (input.tools.length > 0) {
          await supabase.from("worker_tools").insert(
            input.tools.map((name) => ({ worker_id: uid, tool_name: name }))
          );
        }
      }
    },
    onSuccess: async () => {
      await refreshUser();
      void qc.invalidateQueries({ queryKey: ["worker"] });
    },
  });
}

// ─── Real: Save onboarding ────────────────────────────────────────────────────

export function useSaveOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      skills: { name: string; experience_level?: string }[];
      tools: string[];
      service_radius_km: number;
      latitude?: number | null;
      longitude?: number | null;
      hourly_rate?: number;
      availability_days?: boolean[];
      scheme_eligible?: boolean;
      photoFile?: File | null;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const { data: cats, error: catErr } = await supabase
        .from("service_categories").select("id, name").in("name", input.skills.map((s) => s.name));
      if (catErr) throw catErr;
      const catMap = new Map((cats ?? []).map((c) => [c.name, c.id]));

      let photoUrl: string | undefined;
      if (input.photoFile) {
        const ext = input.photoFile.name.split(".").pop() ?? "jpg";
        const { error: upErr } = await supabase.storage
          .from("worker-profile-photos")
          .upload(`${uid}/avatar.${ext}`, input.photoFile, { upsert: true });
        if (!upErr) {
          const { data: u } = supabase.storage.from("worker-profile-photos").getPublicUrl(`${uid}/avatar.${ext}`);
          photoUrl = u.publicUrl;
        }
      }
      if (photoUrl) await supabase.from("profiles").update({ profile_photo_url: photoUrl }).eq("id", uid);

      const { error: wpErr } = await supabase.from("worker_profiles").upsert({
        user_id: uid,
        service_radius_km: input.service_radius_km,
        latitude:  input.latitude  ?? null,
        longitude: input.longitude ?? null,
        hourly_rate:      input.hourly_rate ?? 0,
        scheme_eligible:  input.scheme_eligible ?? false,
        is_available:     false,
      }, { onConflict: "user_id" });
      if (wpErr) throw wpErr;

      await supabase.from("worker_skills").delete().eq("worker_id", uid);
      const skillInserts = input.skills.filter((s) => catMap.has(s.name)).map((s) => ({
        worker_id: uid, category_id: catMap.get(s.name)!, experience_level: s.experience_level,
      }));
      if (skillInserts.length > 0) await supabase.from("worker_skills").insert(skillInserts);

      await supabase.from("worker_tools").delete().eq("worker_id", uid);
      if (input.tools.length > 0) {
        await supabase.from("worker_tools").insert(
          input.tools.map((name) => ({ worker_id: uid, tool_name: name }))
        );
      }
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["worker"] }); },
  });
}

// ─── Real: Service categories ─────────────────────────────────────────────────

export function useServiceCategories() {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ["service_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_categories").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
  });
}

// ─── Real: Worker Jobs ────────────────────────────────────────────────────────

export function useWorkerJobs(filter: "pending" | "active" | "completed") {
  return useQuery<Job[]>({
    queryKey: ["worker", "jobs", filter],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      if (filter === "pending") {
        // [FIX Bug #1 + #3] Direct query: jobs explicitly assigned to THIS worker
        // by the customer (worker_id = uid) but not yet accepted (status = 'pending').
        // Replaces the old RPC get_pending_jobs_for_worker which returned ALL
        // unassigned jobs matching the worker's skills — causing jobs to appear
        // before the customer had chosen a specific worker.
        const { data, error } = await supabase
          .from("jobs")
          .select(JOB_SELECT)
          .eq("worker_id", uid)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        return (data ?? []).map(mapJobRow);
      }

      if (filter === "active") {
        const { data, error } = await supabase
          .from("jobs")
          .select(JOB_SELECT)
          .eq("worker_id", uid)
          .in("status", ["accepted", "en_route", "in_progress"])
          .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return (data ?? []).map(mapJobRow);
      }

      // completed
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_SELECT)
        .eq("worker_id", uid)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapJobRow);
    },
    refetchInterval: 30000,
  });
}

// ─── Real: Job Detail ─────────────────────────────────────────────────────────

export function useJobDetail(id: string) {
  return useQuery<Job>({
    queryKey: ["worker", "job", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_SELECT)
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      if (!data)  throw new Error("Job not found");
      return mapJobRow(data);
    },
    refetchInterval: 15000,
  });
}

// ─── Real: Update job status ──────────────────────────────────────────────────

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Job["status"] | "declined" }) => {
      // [FIX Bug #3] Map Job["status"] → DB status string
      // "declined" → "cancelled" so customer sees it in their Cancelled tab
      const dbStatus =
        status === "active"   ? "accepted"  :
        status === "declined" ? "cancelled" :
        status;

      const { error } = await supabase
        .from("jobs")
        .update({ status: dbStatus })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id, status };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["worker"] });
      void qc.invalidateQueries({ queryKey: ["customer"] }); // customer bookings also update
    },
    onError: (err: Error) => {
      toast({ title: "Could not update job status", description: err.message });
    },
  });
}

// ─── Mock: Earnings (Phase 7) ─────────────────────────────────────────────────

export function useEarnings(period: "today" | "week" | "month") {
  return useQuery<EarningsData>({
    queryKey: ["worker", "earnings", period],
    queryFn: async () => {
      const days = period === "today" ? ["Today"]
        : period === "week"  ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : Array.from({ length: 30 }, (_, i) => `${i + 1}`);
      return { total: 0, chartData: days.map((day) => ({ day, amount: 0 })), transactions: [] };
    },
  });
}

// ─── Static reference data ────────────────────────────────────────────────────

export const SKILL_OPTIONS = [
  "Plumber", "Electrician", "Carpenter", "Tailor", "Mechanic", "Painter",
  "Mason", "Welder", "AC Technician", "Appliance Repair", "Gardener", "Cleaner",
];

export const TOOLS_BY_SKILL: Record<string, string[]> = {
  Plumber:           ["Pipe Wrench", "Teflon Tape", "Basin Wrench", "Plunger", "Pipe Cutter"],
  Electrician:       ["Multimeter", "Wire Cutter", "Screwdriver Set", "Wire Stripper", "Voltage Tester"],
  Carpenter:         ["Saw", "Hammer", "Measuring Tape", "Chisel Set", "Drill Machine"],
  Tailor:            ["Sewing Machine", "Scissors", "Measuring Tape", "Iron", "Thread Set"],
  Mechanic:          ["Wrench Set", "Jack", "Screwdriver Set", "Pliers", "Oil Can"],
  Painter:           ["Roller Set", "Masking Tape", "Drop Cloth", "Brush Set", "Paint Sprayer"],
  Mason:             ["Trowel", "Level", "Plumb Bob", "Mixing Pan", "Float"],
  Welder:            ["Welding Machine", "Helmet", "Clamps", "Angle Grinder", "Electrode Holder"],
  "AC Technician":   ["Manifold Gauge", "Vacuum Pump", "Flaring Tool", "Leak Detector", "Refrigerant"],
  "Appliance Repair":["Multimeter", "Soldering Iron", "Screwdriver Set", "Pliers", "Heat Gun"],
  Gardener:          ["Pruning Shears", "Shovel", "Rake", "Hose", "Wheelbarrow"],
  Cleaner:           ["Vacuum Cleaner", "Mop Set", "Squeegee", "Spray Bottles", "Gloves"],
};

// ─── Real: Worker submits review of customer ──────────────────────────────────
// PHASE 8: Called from JobRatingScreen when role === "worker".
// Inserts a review where reviewer = worker, reviewee = customer.
// Does NOT update worker_profiles rating (that's for customer→worker reviews).

export function useSubmitWorkerReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      rating,
      comment,
    }: {
      jobId: string;
      rating: number;
      comment: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      // Verify job exists and worker is assigned to it
      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .select("customer_id, worker_id, status")
        .eq("id", jobId)
        .eq("worker_id", uid)
        .single();

      if (jobErr || !job) throw new Error("Job not found");
      if (job.status !== "completed") throw new Error("Can only review completed jobs");

      const { error: reviewErr } = await supabase
        .from("reviews")
        .insert({
          job_id:      jobId,
          reviewer_id: uid,              // worker reviewing
          reviewee_id: job.customer_id,  // customer being reviewed
          rating,
          comment: comment?.trim() || null,
        });

      if (reviewErr) {
        if (reviewErr.code === "23505") throw new Error("You have already reviewed this job");
        throw new Error(reviewErr.message);
      }

      return { jobId, customerId: job.customer_id };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["worker"] });
      void qc.invalidateQueries({ queryKey: ["customer"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not submit review", description: err.message });
    },
  });
}