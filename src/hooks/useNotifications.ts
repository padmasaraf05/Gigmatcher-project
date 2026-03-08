// src/hooks/useNotifications.ts
// PHASE 15: Full rewrite to match NotificationsScreen.tsx interface exactly.
// Exports: AppNotification, useNotifications(filter), useUnreadCount,
//          useMarkRead, useMarkAllRead, useDismissNotification, useClearAll,
//          useUnreadMessages, useMarkMessagesRead

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id:        string;
  type:      string;          // "job" | "payment" | "system"
  title:     string;
  body:      string;
  read:      boolean;         // NotificationsScreen uses n.read (not is_read)
  timestamp: Date;            // NotificationsScreen uses formatDistanceToNow(n.timestamp)
  link?:     string | null;   // navigate to this path on tap
  job_id?:   string | null;
}

// ─── Helper — map DB row → AppNotification ────────────────────────────────────

function mapRow(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  job_id?: string | null;
}): AppNotification {
  let link: string | null = null;
  if (row.job_id) {
    if (row.type === "job") link = `/worker/job/${row.job_id}`;
    else if (row.type === "payment") link = `/customer/booking/${row.job_id}`;
  }

  return {
    id:        row.id,
    type:      row.type ?? "system",
    title:     row.title ?? "",
    body:      row.body  ?? "",
    read:      row.is_read ?? false,
    timestamp: new Date(row.created_at),
    link,
    job_id:    row.job_id ?? null,
  };
}

// ─── Real: Fetch notifications with optional filter ───────────────────────────

export function useNotifications(filter = "all") {
  const { user } = useAuth();
  return useQuery<AppNotification[]>({
    queryKey: ["notifications", user?.id, filter],
    enabled:  !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from("notifications")
        .select("id, type, title, body, is_read, created_at, job_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter !== "all") {
        query = query.eq("type", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    refetchInterval: 30000,
  });
}

// ─── Real: Unread notification count (Bell badge) ─────────────────────────────

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery<number>({
    queryKey: ["notifications", "unread", user?.id],
    enabled:  !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
}

// ─── Real: Mark single notification as read ───────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Real: Mark all notifications as read ────────────────────────────────────

export function useMarkAllRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user?.id ?? "")
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Real: Dismiss (delete) a single notification ────────────────────────────

export function useDismissNotification() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Real: Clear all notifications ───────────────────────────────────────────

export function useClearAll() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── PHASE 15: Unread message count (Messages badge) ─────────────────────────

export function useUnreadMessages() {
  const { user } = useAuth();
  return useQuery<number>({
    queryKey: ["messages", "unread", user?.id],
    enabled:  !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_unread_message_count", { p_user_id: user!.id });
      if (error) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .neq("sender_id", user!.id)
          .eq("is_read", false);
        return count ?? 0;
      }
      return (data as number) ?? 0;
    },
    refetchInterval: 15000,
  });
}

// ─── PHASE 15: Mark job messages as read ─────────────────────────────────────

export function useMarkMessagesRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (jobId: string) => {
      await supabase.rpc("mark_messages_read", {
        p_job_id:  jobId,
        p_user_id: user?.id ?? "",
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["messages", "unread"] });
    },
  });
}