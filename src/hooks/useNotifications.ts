// src/hooks/useNotifications.ts
// POLISH-2 FIX [BADGE COUNT]:
//   useUnreadMessages fallback query was missing receiver_id filter — it was
//   counting ALL unread messages in the entire messages table, not just ones
//   sent TO the current user. Added .eq("receiver_id", user!.id) to fix.
//   All other logic IDENTICAL to previous PHASE 15 version.

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id:        string;
  type:      string;        // "job" | "payment" | "system"
  title:     string;
  body:      string;        // mapped from DB column "message"
  read:      boolean;       // mapped from DB column "is_read"
  timestamp: Date;          // mapped from DB column "created_at"
  link?:     string | null; // DB column "link" — already a full path
}

// ─── Helper — map DB row → AppNotification ────────────────────────────────────

function mapRow(row: {
  id:         string;
  type:       string;
  title:      string | null;
  message:    string | null;
  is_read:    boolean;
  created_at: string;
  link:       string | null;
}): AppNotification {
  return {
    id:        row.id,
    type:      row.type    ?? "system",
    title:     row.title   ?? "",
    body:      row.message ?? "",
    read:      row.is_read ?? false,
    timestamp: new Date(row.created_at),
    link:      row.link    ?? null,
  };
}

// ─── Real: Fetch notifications with filter ────────────────────────────────────

export function useNotifications(filter = "all") {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  return useQuery<AppNotification[]>({
    queryKey: ["notifications", user?.id, filter],
    enabled:  !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from("notifications")
        .select("id, type, title, message, is_read, created_at, link")
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
    staleTime: 0,
  });
}

// ─── Real: Unread count for Bell badge ───────────────────────────────────────

export function useUnreadCount() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-unread:${user.id}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, qc]);

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
    staleTime: 0,
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

// ─── PHASE 15 + POLISH-2 FIX: Unread message count (Messages badge) ──────────
// [POLISH-2 FIX] The RPC fallback query was missing .eq("receiver_id", user.id)
// which caused it to count ALL unread messages in the table, making the badge
// show a large hardcoded-looking number. Now correctly filters to messages
// sent TO the current user only.

export function useUnreadMessages() {
  const { user } = useAuth();
  return useQuery<number>({
    queryKey: ["messages", "unread", user?.id],
    enabled:  !!user?.id,
    queryFn: async () => {
      // Try RPC first (most efficient)
      const { data, error } = await supabase
        .rpc("get_unread_message_count", { p_user_id: user!.id });
      if (!error) {
        return (data as number) ?? 0;
      }

      // [POLISH-2 FIX] Fallback: direct query with receiver_id filter
      // Previously this was missing .eq("receiver_id", user!.id) which
      // caused it to count every unread message from every user.
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id)   // ← THE FIX: only messages TO this user
        .eq("is_read", false);
      return count ?? 0;
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