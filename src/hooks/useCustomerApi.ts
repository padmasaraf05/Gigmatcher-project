// src/hooks/useCustomerApi.ts
// [MATCHING UPDATE] useAvailableWorkers Supabase fallback now:
//   1. Fetches worker_profiles.latitude + longitude
//   2. Calculates Haversine distance from customer → worker saved address
//   3. Formats distance as "1.2 km" or "800 m"
//   4. Sorts correctly when sort === "distance"
//   Added distanceKm: number | null to WorkerCard type for sort precision.
// All other logic IDENTICAL to previous version.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerCard {
  id: string;
  name: string;
  photo: string;
  rating: number;
  reviewCount: number;
  distance: string;
  distanceKm: number | null; // [MATCHING] raw km value for sorting
  rate: number;
  skills: string[];
  tools: string[];
  hasAllTools: boolean;
  missingToolCount: number;
  available: boolean;
  availableDays: boolean[];
  reviews: Review[];
}

export interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Booking {
  id: string;
  workerId: string;
  workerName: string;
  workerPhoto: string;
  workerPhone: string;
  workerRating: number;
  serviceType: string;
  description: string;
  address: string;
  latitude:  number | null;
  longitude: number | null;
  date: string;
  time: string;
  status: "pending" | "accepted" | "en_route" | "in_progress" | "completed" | "cancelled";
  payment: number;
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "refunded";
  eta?: string;
  workerDistance?: string;
  photoUrls: string[];
}

export interface DashboardData {
  activeBookings: Booking[];
  recentWorkers: WorkerCard[];
}

export interface BookJobInput {
  workerId:      string;
  categorySlug:  string;
  description:   string;
  address:       string;
  latitude:      number | null;
  longitude:     number | null;
  date:          string;
  timeSlot:      string;
  urgency:       "normal" | "urgent";
  requiredTools: string[];
  budget?:       number | null;
  photoUrls?:    string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TIME_SLOT_HOURS: Record<string, number> = {
  Morning:   9,
  Afternoon: 14,
  Evening:   18,
  Urgent:    new Date().getHours() + 1,
};

function extractWorkerRating(profileRow: unknown): number {
  if (!profileRow || typeof profileRow !== "object") return 0;
  const p  = profileRow as Record<string, unknown>;
  const wp = Array.isArray(p.worker_profiles) ? p.worker_profiles[0] : p.worker_profiles;
  if (!wp || typeof wp !== "object") return 0;
  const r = (wp as Record<string, unknown>).rating;
  return typeof r === "number" ? r : 0;
}

// ─── [MATCHING] Haversine distance ───────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ─── FastAPI types ────────────────────────────────────────────────────────────

const MATCHING_API_URL = (import.meta.env.VITE_MATCHING_API_URL as string | undefined)
  ?.replace(/\/$/, "") ?? null;

interface ApiWorkerResult {
  id:                 string;
  name:               string;
  photo:              string;
  rating:             number;
  review_count:       number;
  distance:           string;
  distance_km:        number | null;
  rate:               number;
  skills:             string[];
  tools:              string[];
  has_all_tools:      boolean;
  missing_tool_count: number;
  available:          boolean;
  availability_days:  boolean[];
  is_pro:             boolean;
}

function sortWorkers(workers: WorkerCard[], sort: string): WorkerCard[] {
  if (sort === "rating")   return [...workers].sort((a, b) => b.rating - a.rating);
  if (sort === "price")    return [...workers].sort((a, b) => a.rate - b.rate);
  if (sort === "distance") {
    return [...workers].sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }
  return workers;
}

// ─── Available Workers ────────────────────────────────────────────────────────

export function useAvailableWorkers(filters: {
  sort: string;
  categorySlug?: string | null;
  requiredTools?: string[];
  customerLat?: number | null;
  customerLng?: number | null;
}) {
  return useQuery<WorkerCard[]>({
    queryKey: ["customer", "workers", filters],
    queryFn: async (): Promise<WorkerCard[]> => {

      if (!filters.categorySlug) {
        await delay(400);
        return sortWorkers([...MOCK_WORKERS], filters.sort);
      }

      // FastAPI path
      if (MATCHING_API_URL) {
        try {
          const body = {
            category_slug:  filters.categorySlug,
            required_tools: filters.requiredTools ?? [],
            sort:           filters.sort,
            customer_lat:   filters.customerLat  ?? null,
            customer_lng:   filters.customerLng  ?? null,
          };
          const res = await fetch(`${MATCHING_API_URL}/match`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(body),
          });
          if (!res.ok) throw new Error(`Matching API error ${res.status}`);
          const json = await res.json() as { workers?: ApiWorkerResult[] };
          return (json.workers ?? []).map((w): WorkerCard => ({
            id:               w.id              ?? "",
            name:             w.name            ?? "Worker",
            photo:            w.photo           ?? "",
            rating:           Number(w.rating)  || 0,
            reviewCount:      Number(w.review_count) || 0,
            distance:         w.distance        ?? "—",
            distanceKm:       w.distance_km     ?? null,
            rate:             Number(w.rate)     || 0,
            skills:           Array.isArray(w.skills) ? w.skills : [],
            tools:            Array.isArray(w.tools)  ? w.tools  : [],
            hasAllTools:      w.has_all_tools   ?? true,
            missingToolCount: w.missing_tool_count ?? 0,
            available:        w.available       ?? true,
            availableDays:    Array.isArray(w.availability_days)
                                ? w.availability_days
                                : [true,true,true,true,true,true,true],
            reviews: [],
          }));
        } catch (err) {
          console.error("[useAvailableWorkers] FastAPI failed, falling back:", err);
        }
      }

      // Supabase fallback — with real distance calculation
      const selectedSvc = SERVICE_CATEGORIES.find((s) => s.id === filters.categorySlug);
      if (!selectedSvc) return [];

      const { data: catData, error: catError } = await supabase
        .from("service_categories").select("id").eq("name", selectedSvc.label).single();
      if (catError || !catData) return [];

      const { data: skillRows } = await supabase
        .from("worker_skills").select("worker_id").eq("category_id", catData.id);
      if (!skillRows?.length) return [];

      const workerIds = skillRows.map((r) => r.worker_id);

      // [MATCHING] latitude + longitude added to select
      const { data: wpRows } = await supabase
        .from("worker_profiles")
        .select("user_id, is_available, is_pro, rating, total_reviews, hourly_rate, availability_days, latitude, longitude")
        .in("user_id", workerIds);
      if (!wpRows?.length) return [];

      const availableWps = wpRows.filter((wp) => wp.is_available === true);
      if (!availableWps.length) return [];

      const ids = availableWps.map((wp) => wp.user_id);
      const [profileRes, toolRes, skillRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, profile_photo_url").in("id", ids),
        supabase.from("worker_tools").select("worker_id, tool_name").in("worker_id", ids),
        supabase.from("worker_skills").select("worker_id, service_categories(name)").in("worker_id", ids),
      ]);

      const requiredTools  = filters.requiredTools ?? [];
      const hasCustomerLoc = filters.customerLat != null && filters.customerLng != null;

      const workers = availableWps.map((wp): WorkerCard => {
        const profile    = profileRes.data?.find((p) => p.id === wp.user_id);
        const toolNames  = (toolRes.data ?? []).filter((t) => t.worker_id === wp.user_id).map((t) => t.tool_name);
        const skillNames = (skillRes.data ?? [])
          .filter((s) => s.worker_id === wp.user_id)
          .map((s) => (s.service_categories as unknown as { name: string } | null)?.name ?? "")
          .filter(Boolean);
        const missing = requiredTools.filter(
          (t) => !toolNames.map((wt) => wt.toLowerCase()).includes(t.toLowerCase())
        );

        // [MATCHING] Calculate Haversine distance if coordinates exist on both sides
        let distanceKm:  number | null = null;
        let distanceStr  = "—";
        const workerLat = (wp as { latitude?: number | null }).latitude;
        const workerLng = (wp as { longitude?: number | null }).longitude;

        if (hasCustomerLoc && typeof workerLat === "number" && typeof workerLng === "number") {
          distanceKm  = haversineKm(filters.customerLat!, filters.customerLng!, workerLat, workerLng);
          distanceStr = formatDistance(distanceKm);
        }

        return {
          id:               wp.user_id,
          name:             profile?.full_name ?? "Worker",
          photo:            profile?.profile_photo_url ?? "",
          rating:           wp.rating ?? 0,
          reviewCount:      wp.total_reviews ?? 0,
          distance:         distanceStr,
          distanceKm,
          rate:             wp.hourly_rate ?? 0,
          skills:           skillNames,
          tools:            toolNames,
          hasAllTools:      missing.length === 0,
          missingToolCount: missing.length,
          available:        wp.is_available,
          availableDays:    (wp.availability_days as boolean[] | null) ?? [true,true,true,true,true,true,true],
          reviews:          [],
        };
      });

      return sortWorkers(workers, filters.sort);
    },
  });
}

// ─── Worker Public Profile ────────────────────────────────────────────────────

export function useWorkerPublicProfile(id: string) {
  return useQuery<WorkerCard>({
    queryKey: ["customer", "worker", id],
    enabled: !!id && !id.startsWith("w-"),
    queryFn: async () => {
      if (!id) throw new Error("No worker id");
      const [profileRes, wpRes, skillsRes, toolsRes, reviewsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, profile_photo_url").eq("id", id).single(),
        supabase.from("worker_profiles").select("is_available, is_pro, rating, total_reviews, hourly_rate, availability_days").eq("user_id", id).maybeSingle(),
        supabase.from("worker_skills").select("service_categories(name)").eq("worker_id", id),
        supabase.from("worker_tools").select("tool_name").eq("worker_id", id),
        supabase.from("reviews").select("id, rating, comment, created_at, profiles!reviewer_id(full_name)").eq("reviewee_id", id).order("created_at", { ascending: false }).limit(10),
      ]);
      if (profileRes.error) throw new Error(profileRes.error.message);
      const p  = profileRes.data;
      const wp = wpRes.data;
      const skills = (skillsRes.data ?? [])
        .map((s) => (s.service_categories as unknown as { name: string } | null)?.name ?? "")
        .filter(Boolean);
      const tools = (toolsRes.data ?? []).map((t) => t.tool_name);
      const reviews: Review[] = (reviewsRes.data ?? []).map((r) => {
        const reviewer  = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        const createdAt = new Date(r.created_at);
        const daysAgo   = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const dateStr =
          daysAgo === 0 ? "Today" :
          daysAgo === 1 ? "Yesterday" :
          daysAgo < 7   ? `${daysAgo} days ago` :
          daysAgo < 30  ? `${Math.floor(daysAgo / 7)} week${daysAgo >= 14 ? "s" : ""} ago` :
          createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        return { id: r.id, customerName: (reviewer as { full_name?: string } | null)?.full_name ?? "Customer", rating: r.rating, comment: r.comment ?? "", date: dateStr };
      });
      return {
        id: p?.id ?? id, name: p?.full_name ?? "Worker", photo: p?.profile_photo_url ?? "",
        rating: wp?.rating ?? 0, reviewCount: wp?.total_reviews ?? 0, distance: "—", distanceKm: null,
        rate: wp?.hourly_rate ?? 0, skills, tools, hasAllTools: true, missingToolCount: 0,
        available: wp?.is_available ?? false, availableDays: (wp?.availability_days as boolean[] | null) ?? [true,true,true,true,true,true,true], reviews,
      };
    },
  });
}

// ─── Book a Worker ────────────────────────────────────────────────────────────

export function useBookJob() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BookJobInput) => {
      if (!user?.id) throw new Error("Not authenticated");
      const selectedSvc = SERVICE_CATEGORIES.find((s) => s.id === input.categorySlug);
      if (!selectedSvc) throw new Error("Invalid service category");
      const { data: catData, error: catError } = await supabase
        .from("service_categories").select("id").eq("name", selectedSvc.label).single();
      if (catError || !catData) throw new Error("Service category not found in database");
      let scheduledTime: string | null = null;
      if (input.date) {
        const hour = TIME_SLOT_HOURS[input.timeSlot] ?? 9;
        const dt   = new Date(`${input.date}T${String(hour).padStart(2, "0")}:00:00`);
        scheduledTime = dt.toISOString();
      }
      const { data: newJob, error: insertError } = await supabase
        .from("jobs")
        .insert({
          customer_id: user.id, worker_id: input.workerId, category_id: catData.id,
          description: input.description.trim() || null, required_tools: input.requiredTools,
          urgency: input.urgency, scheduled_time: scheduledTime,
          address: input.address || null, latitude: input.latitude ?? null, longitude: input.longitude ?? null,
          status: "pending", payment_status: "pending",
          estimated_price: input.budget ?? null, photo_urls: input.photoUrls ?? [],
        })
        .select("id").single();
      if (insertError) throw new Error(insertError.message);
      if (!newJob) throw new Error("Failed to create job");
      return { jobId: newJob.id, workerId: input.workerId };
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["customer"] }); },
    onError: (err: Error) => { toast({ title: "Booking failed", description: err.message }); },
  });
}

// ─── Customer Dashboard ───────────────────────────────────────────────────────

export function useCustomerDashboard() {
  const { user } = useAuth();
  return useQuery<DashboardData>({
    queryKey: ["customer", "dashboard", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const userId = user!.id;
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select(`id, status, estimated_price, final_price, payment_status, scheduled_time, worker_id, category_id, latitude, longitude, service_categories(name), profiles!worker_id(full_name, phone, profile_photo_url, worker_profiles(rating))`)
        .eq("customer_id", userId).not("status", "in", '("completed","cancelled")').order("created_at", { ascending: false });
      if (jobsError) throw new Error(jobsError.message);
      const activeBookings: Booking[] = (jobsData ?? []).map((job) => {
        const cat = Array.isArray(job.service_categories) ? job.service_categories[0] : job.service_categories;
        const workerProfile = Array.isArray(job.profiles) ? job.profiles[0] : job.profiles;
        const dt = job.scheduled_time ? new Date(job.scheduled_time) : null;
        return {
          id: job.id, workerId: job.worker_id ?? "",
          workerName: (workerProfile as { full_name?: string } | null)?.full_name ?? (job.worker_id ? "Awaiting worker" : "Finding worker…"),
          workerPhoto: (workerProfile as { profile_photo_url?: string } | null)?.profile_photo_url ?? "",
          workerPhone: (workerProfile as { phone?: string } | null)?.phone ?? "",
          workerRating: extractWorkerRating(workerProfile),
          serviceType: (cat as { name?: string } | null)?.name ?? "Service",
          description: "", address: "",
          latitude: (job as { latitude?: number | null }).latitude ?? null,
          longitude: (job as { longitude?: number | null }).longitude ?? null,
          date: dt ? dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "TBD",
          time: dt ? dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
          status: job.status as Booking["status"],
          payment: (job as { final_price?: number | null }).final_price ?? job.estimated_price ?? 0,
          paymentMethod: "Cash",
          paymentStatus: ((job as { payment_status?: string }).payment_status as Booking["paymentStatus"]) ?? "pending",
          eta: undefined, photoUrls: [],
        };
      });
      const { data: completedJobs } = await supabase
        .from("jobs")
        .select(`worker_id, profiles!worker_id(id, full_name, profile_photo_url, worker_profiles(rating))`)
        .eq("customer_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(20);
      const seenWorkerIds = new Set<string>();
      const recentWorkers: WorkerCard[] = [];
      for (const job of completedJobs ?? []) {
        if (!job.worker_id || seenWorkerIds.has(job.worker_id)) continue;
        if (recentWorkers.length >= 5) break;
        seenWorkerIds.add(job.worker_id);
        const p = Array.isArray(job.profiles) ? job.profiles[0] : job.profiles;
        const pObj = p as { full_name?: string; profile_photo_url?: string; worker_profiles?: unknown } | null;
        const wpRaw = pObj?.worker_profiles;
        const wp = Array.isArray(wpRaw) ? wpRaw[0] : wpRaw;
        recentWorkers.push({
          id: job.worker_id, name: pObj?.full_name ?? "Worker", photo: pObj?.profile_photo_url ?? "",
          rating: (wp as { rating?: number } | null)?.rating ?? 0,
          reviewCount: 0, distance: "", distanceKm: null, rate: 0, skills: [], tools: [],
          hasAllTools: false, missingToolCount: 0, available: false, availableDays: [], reviews: [],
        });
      }
      return { activeBookings, recentWorkers };
    },
    refetchInterval: 30000,
  });
}

// ─── Customer Bookings ────────────────────────────────────────────────────────

export function useCustomerBookings(tab: "active" | "pending" | "completed" | "cancelled") {
  const { user } = useAuth();
  return useQuery<Booking[]>({
    queryKey: ["customer", "bookings", tab, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const userId = user!.id;
      const statusFilter: Record<typeof tab, string[]> = {
        active: ["accepted", "en_route", "in_progress"], pending: ["pending"],
        completed: ["completed"], cancelled: ["cancelled"],
      };
      const { data, error } = await supabase
        .from("jobs")
        .select(`id, status, estimated_price, final_price, payment_status, scheduled_time, description, address, worker_id, latitude, longitude, service_categories(name), profiles!worker_id(full_name, phone, profile_photo_url, worker_profiles(rating))`)
        .eq("customer_id", userId).in("status", statusFilter[tab]).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((job): Booking => {
        const cat = Array.isArray(job.service_categories) ? job.service_categories[0] : job.service_categories;
        const wp = Array.isArray(job.profiles) ? job.profiles[0] : job.profiles;
        const dt = job.scheduled_time ? new Date(job.scheduled_time) : null;
        return {
          id: job.id, workerId: job.worker_id ?? "",
          workerName: (wp as { full_name?: string } | null)?.full_name ?? (job.worker_id ? "Awaiting worker" : "Finding worker…"),
          workerPhoto: (wp as { profile_photo_url?: string } | null)?.profile_photo_url ?? "",
          workerPhone: (wp as { phone?: string } | null)?.phone ?? "",
          workerRating: extractWorkerRating(wp),
          serviceType: (cat as { name?: string } | null)?.name ?? "Service",
          description: job.description ?? "", address: job.address ?? "",
          latitude: (job as { latitude?: number | null }).latitude ?? null,
          longitude: (job as { longitude?: number | null }).longitude ?? null,
          date: dt ? dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "TBD",
          time: dt ? dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
          status: job.status as Booking["status"],
          payment: (job as { final_price?: number | null }).final_price ?? job.estimated_price ?? 0,
          paymentMethod: "Cash",
          paymentStatus: ((job as { payment_status?: string }).payment_status as Booking["paymentStatus"]) ?? "pending",
          eta: undefined, photoUrls: [],
        };
      });
    },
    refetchInterval: 30000,
  });
}

// ─── Booking Detail ───────────────────────────────────────────────────────────

export function useBookingDetail(id: string) {
  const { user } = useAuth();
  return useQuery<Booking>({
    queryKey: ["customer", "booking", id],
    enabled: !!id && !!user?.id,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(`id, status, estimated_price, final_price, payment_status, scheduled_time, description, address, worker_id, urgency, latitude, longitude, photo_urls, service_categories(name), profiles!worker_id(full_name, phone, profile_photo_url, worker_profiles(rating))`)
        .eq("id", id).eq("customer_id", user!.id).single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Booking not found");
      const cat = Array.isArray(data.service_categories) ? data.service_categories[0] : data.service_categories;
      const wp = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      const dt = data.scheduled_time ? new Date(data.scheduled_time) : null;
      return {
        id: data.id, workerId: data.worker_id ?? "",
        workerName: (wp as { full_name?: string } | null)?.full_name ?? (data.worker_id ? "Awaiting worker" : "Finding worker…"),
        workerPhoto: (wp as { profile_photo_url?: string } | null)?.profile_photo_url ?? "",
        workerPhone: (wp as { phone?: string } | null)?.phone ?? "",
        workerRating: extractWorkerRating(wp),
        serviceType: (cat as { name?: string } | null)?.name ?? "Service",
        description: data.description ?? "", address: data.address ?? "",
        latitude: (data as { latitude?: number | null }).latitude ?? null,
        longitude: (data as { longitude?: number | null }).longitude ?? null,
        date: dt ? dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "TBD",
        time: dt ? dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
        status: data.status as Booking["status"],
        payment: (data as { final_price?: number | null }).final_price ?? data.estimated_price ?? 0,
        paymentMethod: "Cash",
        paymentStatus: ((data as { payment_status?: string }).payment_status as Booking["paymentStatus"]) ?? "pending",
        eta: undefined, photoUrls: (data as { photo_urls?: string[] }).photo_urls ?? [],
      };
    },
  });
}

// ─── Cancel Booking ───────────────────────────────────────────────────────────

export function useCancelBooking() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId).eq("customer_id", user!.id);
      if (error) throw new Error(error.message);
      return jobId;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["customer"] }); },
    onError: (err: Error) => { toast({ title: "Could not cancel booking", description: err.message }); },
  });
}

// ─── Submit Review ────────────────────────────────────────────────────────────

export function useSubmitReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { bookingId: string; rating: number; comment: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data: job, error: jobErr } = await supabase.from("jobs").select("worker_id, customer_id, status").eq("id", data.bookingId).single();
      if (jobErr || !job) throw new Error("Job not found");
      if (job.status !== "completed") throw new Error("Can only review completed jobs");
      if (!job.worker_id) throw new Error("No worker assigned to this job");
      const { error: reviewErr } = await supabase.from("reviews").insert({
        job_id: data.bookingId, reviewer_id: user.id, reviewee_id: job.worker_id,
        rating: data.rating, comment: data.comment?.trim() || null,
      });
      if (reviewErr) {
        if (reviewErr.code === "23505") throw new Error("You have already reviewed this job");
        throw new Error(reviewErr.message);
      }
      return { jobId: data.bookingId, workerId: job.worker_id };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["customer"] });
      void qc.invalidateQueries({ queryKey: ["customer", "worker", result?.workerId] });
      void qc.invalidateQueries({ queryKey: ["worker"] });
    },
    onError: (err: Error) => { toast({ title: "Could not submit review", description: err.message }); },
  });
}

// ─── Static data ──────────────────────────────────────────────────────────────

export const SERVICE_CATEGORIES = [
  { id: "plumber",     label: "Plumber",     icon: "🔧" },
  { id: "electrician", label: "Electrician", icon: "⚡" },
  { id: "carpenter",   label: "Carpenter",   icon: "🪚" },
  { id: "tailor",      label: "Tailor",      icon: "🧵" },
  { id: "mechanic",    label: "Mechanic",    icon: "🔩" },
  { id: "painter",     label: "Painter",     icon: "🎨" },
];

export const TOOLS_BY_SERVICE: Record<string, string[]> = {
  plumber:     ["Pipe Wrench", "Teflon Tape", "Basin Wrench", "Plunger"],
  electrician: ["Multimeter", "Wire Cutter", "Screwdriver Set", "Voltage Tester"],
  carpenter:   ["Saw", "Hammer", "Measuring Tape", "Chisel Set"],
  tailor:      ["Sewing Machine", "Scissors", "Measuring Tape", "Iron"],
  mechanic:    ["Wrench Set", "Jack", "Screwdriver Set", "Pliers"],
  painter:     ["Roller Set", "Masking Tape", "Drop Cloth", "Brush Set"],
};

export const PRICE_ESTIMATES: Record<string, string> = {
  plumber:     "₹200–₹800",
  electrician: "₹300–₹1,000",
  carpenter:   "₹500–₹2,500",
  tailor:      "₹150–₹600",
  mechanic:    "₹400–₹1,500",
  painter:     "₹500–₹3,000",
};

const MOCK_WORKERS: WorkerCard[] = [
  {
    id: "w-1", name: "Rajesh Kumar", photo: "", rating: 4.8, reviewCount: 142,
    distance: "1.2 km", distanceKm: 1.2, rate: 350, skills: ["Electrician", "AC Technician"],
    tools: ["Multimeter", "Wire Cutter", "Screwdriver Set", "Voltage Tester"],
    hasAllTools: true, missingToolCount: 0, available: true,
    availableDays: [true,true,false,true,true,true,false],
    reviews: [
      { id: "r1", customerName: "Amit S.", rating: 5, comment: "Excellent work!", date: "2 days ago" },
      { id: "r2", customerName: "Priya M.", rating: 4, comment: "Good work, came on time.", date: "1 week ago" },
    ],
  },
  {
    id: "w-2", name: "Sunil Yadav", photo: "", rating: 4.5, reviewCount: 89,
    distance: "2.8 km", distanceKm: 2.8, rate: 280, skills: ["Plumber", "Mechanic"],
    tools: ["Pipe Wrench", "Teflon Tape", "Plunger"],
    hasAllTools: false, missingToolCount: 1, available: true,
    availableDays: [true,false,true,true,false,true,true],
    reviews: [{ id: "r4", customerName: "Neha R.", rating: 5, comment: "Fixed leaking pipe quickly.", date: "3 days ago" }],
  },
  {
    id: "w-3", name: "Vikram Singh", photo: "", rating: 4.9, reviewCount: 210,
    distance: "3.5 km", distanceKm: 3.5, rate: 450, skills: ["Carpenter", "Painter"],
    tools: ["Saw", "Hammer", "Measuring Tape", "Chisel Set", "Drill Machine"],
    hasAllTools: true, missingToolCount: 0, available: true,
    availableDays: [false,true,true,true,true,false,true],
    reviews: [{ id: "r7", customerName: "Deepak T.", rating: 5, comment: "Built amazing custom furniture!", date: "1 day ago" }],
  },
];