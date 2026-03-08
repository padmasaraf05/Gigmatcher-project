// src/hooks/useJobLifecycle.ts
// PHASE 6 FIXES:
//   [FIX 1] "declined" now sets DB status = 'cancelled' (was re-queuing with
//            status='pending', worker_id=null — wrong per the agreed flow where
//            the customer chose a specific worker and must be notified of rejection)
//   [FIX 2] "cancelled" mapping was incorrectly writing 'pending' to the DB.
//            Now writes 'cancelled' directly.
//   All other logic (polling, live location mock) — unchanged.
//
// PHASE 9 — Real-time Messaging:
//   useMessages() — replaces mock with:
//     1. Initial fetch from messages table (ordered by created_at ASC)
//        Joins profiles!sender_id to get sender name.
//     2. Supabase Realtime subscription on INSERT filtered by job_id.
//        New messages are appended to React Query cache instantly —
//        no polling, no page refresh needed.
//     3. Subscription cleaned up on unmount via useEffect return.
//   useSendMessage() — replaces mock with:
//     Real INSERT into messages table.
//     Fetches job to resolve receiver_id (the other party on the job).
//   PREREQUISITE: run phase9_prerequisites.sql in Supabase SQL Editor first.
//     This enables RLS, adds policies, and adds messages to supabase_realtime.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { type JobStatus, getStatusToastMessage } from "@/lib/jobStateMachine";
import { toast } from "@/hooks/use-toast";

// ─── Real: Job status polling ─────────────────────────────────────────────────

export function useJobStatusPolling(jobId: string, initialStatus?: JobStatus) {
  return useQuery<JobStatus>({
    queryKey: ["jobStatus", jobId],
    enabled: !!jobId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("status")
        .eq("id", jobId)
        .single();

      if (error || !data) {
        console.warn("[useJobStatusPolling] Could not fetch status:", error?.message);
        return initialStatus ?? "pending";
      }

      return data.status as JobStatus;
    },
  });
}

// ─── Real: Job status mutation ────────────────────────────────────────────────

export function useJobStatusMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      status,
    }: {
      jobId: string;
      status: JobStatus;
    }) => {
      // [FIX 1 + FIX 2] Correct DB status mapping:
      //   "declined"  → "cancelled"  (worker rejected; customer sees in Cancelled tab)
      //   "cancelled" → "cancelled"  (was wrongly writing "pending" before)
      //   all others  → pass through unchanged
      const dbStatus = status === "declined" ? "cancelled" : status;

      const { error } = await supabase
        .from("jobs")
        .update({ status: dbStatus })
        .eq("id", jobId);

      if (error) throw new Error(error.message);
      return status;
    },
    onSuccess: (status, { jobId }) => {
      qc.setQueryData(["jobStatus", jobId], status);
      void qc.invalidateQueries({ queryKey: ["worker"] });
      void qc.invalidateQueries({ queryKey: ["customer"] });
      toast({ title: getStatusToastMessage(status) });
    },
    onError: (err: Error) => {
      toast({ title: "Status update failed", description: err.message });
    },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;        // mapped from messages.content
  timestamp: string;
  isMine: boolean;
}

// ─── Helper — map a raw messages DB row → Message ────────────────────────────

function mapMessage(
  row: {
    id: string;
    content: string | null;
    created_at: string;
    sender_id: string;
    profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  },
  currentUserId: string
): Message {
  const sender  = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const isMine  = row.sender_id === currentUserId;
  return {
    id:         row.id,
    senderId:   row.sender_id,
    senderName: isMine
      ? "You"
      : (sender as { full_name?: string | null } | null)?.full_name ?? "Other",
    text:       row.content ?? "",
    timestamp:  new Date(row.created_at).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit",
    }),
    isMine,
  };
}

// ─── Real: useMessages — initial fetch + Realtime subscription ────────────────
// PHASE 9: Replaces mock polling with live Supabase Realtime channel.
//
// Flow:
//   1. Initial fetch — all messages for this job ordered by created_at ASC
//   2. useEffect sets up a Realtime channel on postgres_changes INSERT
//      filtered to this job_id
//   3. On each INSERT event: fetch the full row (with sender profile) and
//      append to React Query cache — UI updates instantly without re-fetching
//      the entire list
//   4. useEffect cleanup removes the channel on unmount

export function useMessages(jobId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── Initial fetch ──────────────────────────────────────────────────────────
  const query = useQuery<Message[]>({
    queryKey: ["messages", jobId, user?.id],   // user?.id isolates cache per user
    enabled: !!jobId && !!user?.id,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, created_at, sender_id, profiles!sender_id ( full_name )")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => mapMessage(row, user!.id));
    },
  });

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || !user?.id) return;

    const channel = supabase
      .channel(`messages-job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "messages",
          filter: `job_id=eq.${jobId}`,
        },
        async (payload) => {
          // Fetch the full new row including sender profile
          // (postgres_changes payload doesn't include joined columns)
          const { data: newRow } = await supabase
            .from("messages")
            .select("id, content, created_at, sender_id, profiles!sender_id ( full_name )")
            .eq("id", (payload.new as { id: string }).id)
            .single();

          if (!newRow) return;

          const newMsg = mapMessage(newRow, user.id);

          // Append to cache — avoids full re-fetch
          qc.setQueryData<Message[]>(["messages", jobId, user.id], (prev) => {
            if (!prev) return [newMsg];
            // Guard: skip if already in cache (e.g. from optimistic insert)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    // Cleanup on unmount or jobId/user change
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId, user?.id, qc]);

  return query;
}

// ─── Real: useSendMessage ─────────────────────────────────────────────────────
// PHASE 9: Replaces mock with real INSERT into messages table.
//
// Resolves receiver_id by fetching the job and taking the other party:
//   current user = customer → receiver = worker_id
//   current user = worker   → receiver = customer_id

export function useSendMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, text }: { jobId: string; text: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Resolve receiver — the other participant on this job
      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .select("customer_id, worker_id")
        .eq("id", jobId)
        .single();

      if (jobErr || !job) throw new Error("Job not found");

      const receiverId =
        job.customer_id === user.id ? job.worker_id : job.customer_id;

      if (!receiverId) throw new Error("No receiver found for this job");

      const { error: insertErr } = await supabase
        .from("messages")
        .insert({
          job_id:      jobId,
          sender_id:   user.id,
          receiver_id: receiverId,
          content:     text,
        });

      if (insertErr) throw new Error(insertErr.message);
      // Realtime will push the new message to useMessages cache automatically.
      // Returning void — no optimistic update needed.
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send message", description: err.message });
      void qc.invalidateQueries({ queryKey: ["messages"] }); // invalidates all message caches
    },
  });
}

// ─── Real: useEditMessage ─────────────────────────────────────────────────────
// Updates messages.content in DB. Only the sender can edit their own message
// (enforced by RLS update policy added in phase9_prerequisites.sql).

export function useEditMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, jobId, text }: { messageId: string; jobId: string; text: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("messages")
        .update({ content: text })
        .eq("id", messageId)
        .eq("sender_id", user.id); // extra safety — only own messages

      if (error) throw new Error(error.message);
      return { messageId, jobId, text };
    },
    onSuccess: ({ messageId, jobId, text }) => {
      // Patch cache directly — no full refetch needed
      qc.setQueryData<Message[]>(["messages", jobId, user?.id], (prev) =>
        prev?.map((m) => m.id === messageId ? { ...m, text } : m) ?? []
      );
    },
    onError: (err: Error) => {
      toast({ title: "Could not edit message", description: err.message });
    },
  });
}

// ─── Real: useDeleteMessage ───────────────────────────────────────────────────
// Deletes a message row. Only the sender can delete their own message.

export function useDeleteMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, jobId }: { messageId: string; jobId: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", user.id); // only own messages

      if (error) throw new Error(error.message);
      return { messageId, jobId };
    },
    onSuccess: ({ messageId, jobId }) => {
      // Remove from cache directly
      qc.setQueryData<Message[]>(["messages", jobId, user?.id], (prev) =>
        prev?.filter((m) => m.id !== messageId) ?? []
      );
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete message", description: err.message });
    },
  });
}

// ─── Real: useLiveLocation — Phase 11 ────────────────────────────────────────
// GPS tracking with Leaflet + OpenStreetMap (no API key required).
//
// WORKER flow:
//   1. navigator.geolocation.watchPosition() streams GPS coordinates
//   2. Each position update → UPDATE jobs SET worker_latitude, worker_longitude
//   3. Broadcast stops automatically on unmount or when isTracking = false
//
// CUSTOMER flow:
//   1. Initial fetch of jobs.worker_latitude/longitude + job lat/lng
//   2. Realtime subscription on UPDATE to jobs table filtered by job id
//   3. Worker pin on map moves in real-time as the worker moves
//
// Role detection:
//   Fetches jobs.worker_id — if it matches auth.uid() → worker (broadcast mode)
//   Otherwise → customer (receive mode)
//
// PREREQUISITE: run phase11_prerequisites.sql first.
//   Adds worker_latitude/longitude columns + Realtime on jobs table.

export interface LiveLocationData {
  workerLat: number | null;
  workerLng: number | null;
  jobLat: number | null;
  jobLng: number | null;
  distance: string;
  isWorker: boolean;
  gpsError: string | null;
}

export function useLiveLocation(jobId: string, isTracking: boolean) {
  const { user } = useAuth();
  const [data, setData] = useState<LiveLocationData>({
    workerLat: null,
    workerLng: null,
    jobLat: null,
    jobLng: null,
    distance: "—",
    isWorker: false,
    gpsError: null,
  });

  useEffect(() => {
    if (!isTracking || !jobId || !user?.id) return;

    let watchId: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function init() {
      // Fetch job to determine role + get job coordinates
      const { data: job, error } = await supabase
        .from("jobs")
        .select("worker_id, latitude, longitude, worker_latitude, worker_longitude")
        .eq("id", jobId)
        .single();

      if (error || !job || cancelled) return;

      const isWorker = job.worker_id === user!.id;

      setData((prev) => ({
        ...prev,
        jobLat:    job.latitude    ?? null,
        jobLng:    job.longitude   ?? null,
        workerLat: job.worker_latitude  ?? null,
        workerLng: job.worker_longitude ?? null,
        isWorker,
      }));

      if (isWorker) {
        // ── WORKER: broadcast GPS position ──────────────────────────────────
        if (!navigator.geolocation) {
          setData((prev) => ({ ...prev, gpsError: "GPS not available on this device" }));
          return;
        }

        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            if (cancelled) return;
            const { latitude: wLat, longitude: wLng } = pos.coords;

            setData((prev) => ({
              ...prev,
              workerLat: wLat,
              workerLng: wLng,
              gpsError: null,
              distance: prev.jobLat && prev.jobLng
                ? `${haversineKm(wLat, wLng, prev.jobLat, prev.jobLng).toFixed(1)} km`
                : "—",
            }));

            // Push to DB — customer's Realtime subscription picks this up
            await supabase
              .from("jobs")
              .update({ worker_latitude: wLat, worker_longitude: wLng })
              .eq("id", jobId);
          },
          (err) => {
            setData((prev) => ({ ...prev, gpsError: err.message }));
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      } else {
        // ── CUSTOMER: subscribe to worker location updates ───────────────────
        channel = supabase
          .channel(`job-location-${jobId}`)
          .on(
            "postgres_changes",
            {
              event:  "UPDATE",
              schema: "public",
              table:  "jobs",
              filter: `id=eq.${jobId}`,
            },
            (payload) => {
              if (cancelled) return;
              const row = payload.new as {
                worker_latitude?: number | null;
                worker_longitude?: number | null;
                latitude?: number | null;
                longitude?: number | null;
              };
              const wLat = row.worker_latitude ?? null;
              const wLng = row.worker_longitude ?? null;
              const jLat = row.latitude ?? null;
              const jLng = row.longitude ?? null;

              setData((prev) => ({
                ...prev,
                workerLat: wLat,
                workerLng: wLng,
                jobLat:    jLat ?? prev.jobLat,
                jobLng:    jLng ?? prev.jobLng,
                distance:  wLat && wLng && jLat && jLng
                  ? `${haversineKm(wLat, wLng, jLat, jLng).toFixed(1)} km`
                  : "—",
              }));
            }
          )
          .subscribe();
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [jobId, isTracking, user?.id]);

  return { data, isLoading: data.workerLat === null && data.jobLat === null };
}

// ─── Haversine distance formula ──────────────────────────────────────────────
// Returns distance in km between two lat/lng coordinates.

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}