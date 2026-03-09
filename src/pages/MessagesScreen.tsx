// src/pages/MessagesScreen.tsx
// BUG FIX [ISSUE 3] — Messages menu item navigated to /messages (no job ID).
//   MessagesScreen expected useParams id — got undefined → blank / broken screen.
//
//   FIX: When no id param is present (i.e. user tapped "Messages" in menu),
//        show a conversations inbox: all jobs where the current user is
//        customer or worker that have at least one message, ordered by
//        most recent message. Tapping a conversation opens the chat.
//
//        When id IS present (navigated from BookingDetail chat button or
//        notification), the existing full chat view renders — UNCHANGED.
//
//   Chat view JSX, Tailwind classes, edit/delete logic — ALL IDENTICAL.
//   Only addition: conversation list branch at the top of the render.

import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMessages, useSendMessage, useEditMessage, useDeleteMessage } from "@/hooks/useJobLifecycle";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Send, ChevronLeft, WifiOff, MessageCircle, Pencil, Trash2, X, Check } from "lucide-react";

// ─── Conversation list item shape ────────────────────────────────────────────
interface Conversation {
  jobId: string;
  serviceType: string;
  otherName: string;
  lastMessage: string;
  lastTime: string;
  status: string;
}

// ─── Conversations inbox query ────────────────────────────────────────────────
function useConversations(userId: string | undefined, role: string | undefined) {
  return useQuery<Conversation[]>({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Conversation[]> => {
      if (!userId) return [];

      // Fetch jobs where user is customer or worker, that have messages
      const { data: jobs, error } = await supabase
        .from("jobs")
        .select(`
          id, status, customer_id, worker_id,
          service_categories ( name ),
          customer:profiles!customer_id ( full_name ),
          worker:profiles!worker_id ( full_name )
        `)
        .or(`customer_id.eq.${userId},worker_id.eq.${userId}`)
        .not("status", "eq", "pending")
        .order("created_at", { ascending: false });

      if (error || !jobs?.length) return [];

      const jobIds = jobs.map((j) => j.id);

      // Get latest message per job
      const { data: messages } = await supabase
        .from("messages")
        .select("job_id, content, created_at")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      // Build one entry per job that has at least one message
      const seen = new Set<string>();
      const conversations: Conversation[] = [];

      for (const msg of messages ?? []) {
        if (seen.has(msg.job_id)) continue;
        seen.add(msg.job_id);

        const job = jobs.find((j) => j.id === msg.job_id);
        if (!job) continue;

        const cat = Array.isArray(job.service_categories) ? job.service_categories[0] : job.service_categories;
        const serviceType = (cat as { name?: string } | null)?.name ?? "Service";

        const customerProfile = Array.isArray(job.customer) ? job.customer[0] : job.customer;
        const workerProfile   = Array.isArray(job.worker)   ? job.worker[0]   : job.worker;

        // Show the other party's name depending on current user's role
        const otherName = role === "worker"
          ? (customerProfile as { full_name?: string } | null)?.full_name ?? "Customer"
          : (workerProfile   as { full_name?: string } | null)?.full_name ?? "Worker";

        const msgDate = new Date(msg.created_at);
        const now     = new Date();
        const isToday = msgDate.toDateString() === now.toDateString();
        const lastTime = isToday
          ? msgDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
          : msgDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

        conversations.push({
          jobId:       job.id,
          serviceType,
          otherName,
          lastMessage: msg.content ?? "",
          lastTime,
          status:      job.status,
        });
      }

      return conversations;
    },
    refetchInterval: 30000,
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnline, role, user } = useAuth();

  // Chat-specific state (only used when id is present)
  const { data: messages, isLoading } = useMessages(id || "");
  const sendMessage  = useSendMessage();
  const editMessage  = useEditMessage();
  const deleteMessage = useDeleteMessage();

  const [text, setText]                   = useState("");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editText, setEditText]           = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Conversations inbox (only used when id is absent)
  const { data: conversations, isLoading: convsLoading } = useConversations(
    user?.id,
    role ?? undefined
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const dismiss = () => setActiveMessageId(null);
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, []);

  const handleSend = () => {
    if (!text.trim() || !id) return;
    sendMessage.mutate({ jobId: id, text: text.trim() });
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBubbleClick = (e: React.MouseEvent, msgId: string, isMine: boolean) => {
    if (!isMine) return;
    e.stopPropagation();
    setActiveMessageId((prev) => (prev === msgId ? null : msgId));
  };

  const startEdit = (e: React.MouseEvent, msgId: string, currentText: string) => {
    e.stopPropagation();
    setEditingId(msgId);
    setEditText(currentText);
    setActiveMessageId(null);
  };

  const submitEdit = (msgId: string) => {
    if (!editText.trim() || !id) return;
    editMessage.mutate({ messageId: msgId, jobId: id, text: editText.trim() });
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleDelete = (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    if (!id) return;
    deleteMessage.mutate({ messageId: msgId, jobId: id });
    setActiveMessageId(null);
  };

  const otherParty = role === "worker" ? "Customer" : "Worker";

  // ── [FIX ISSUE 3] Conversations inbox — shown when no job id in URL ────────
  if (!id) {
    return (
      <div className="app-shell flex flex-col h-screen bg-background">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="touch-target p-2 rounded-full hover:bg-muted transition-default"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">Messages</h2>
            <span className="text-xs text-muted-foreground">All conversations</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {convsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : !conversations?.length ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">No conversations yet</h3>
              <p className="text-sm text-muted-foreground">
                Your job chats will appear here once a booking is active
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.jobId}
                  onClick={() => navigate(`/messages/${conv.jobId}`)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-default hover:bg-muted/50"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                    {conv.otherName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{conv.otherName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.serviceType} · {conv.lastMessage}
                    </p>
                  </div>
                  {conv.lastTime && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{conv.lastTime}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Existing full chat view — IDENTICAL to original ───────────────────────
  return (
    <div className="app-shell flex flex-col h-screen bg-background">
      {/* Header — unchanged */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="touch-target p-2 rounded-full hover:bg-muted transition-default"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground">Messages</h2>
          <span className="text-xs text-accent font-semibold">● Connected to {otherParty}</span>
        </div>
      </header>

      {/* Offline Banner — unchanged */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-secondary/10 px-4 py-2">
          <WifiOff className="h-4 w-4 text-secondary" />
          <span className="text-xs font-semibold text-secondary">Messaging unavailable offline</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className={`h-12 rounded-2xl ${i % 2 === 0 ? "w-2/3" : "w-3/4"}`} />
              </div>
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Start the conversation with your {otherParty.toLowerCase()}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const showTimestamp =
              idx === 0 || messages[idx - 1]?.isMine !== msg.isMine;
            const isActive  = activeMessageId === msg.id;
            const isEditing = editingId === msg.id;

            return (
              <div key={msg.id}>
                {showTimestamp && (
                  <p className={`text-[10px] text-muted-foreground mb-1 ${msg.isMine ? "text-right" : "text-left"}`}>
                    {msg.senderName} • {msg.timestamp}
                  </p>
                )}
                <div className={`flex flex-col ${msg.isMine ? "items-end" : "items-start"}`}>

                  {/* Bubble */}
                  {isEditing ? (
                    <div className="flex items-center gap-2 max-w-[80%]">
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitEdit(msg.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => submitEdit(msg.id)}
                        disabled={editMessage.isPending}
                        className="h-8 w-8 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={(e) => handleBubbleClick(e, msg.id, msg.isMine)}
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed cursor-default ${
                        msg.isMine
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      } ${msg.isMine ? "cursor-pointer" : ""}`}
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* Edit / Delete action row */}
                  {isActive && !isEditing && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 mt-1 bg-card border border-border rounded-full px-2 py-1 shadow-sm"
                    >
                      <button
                        onClick={(e) => startEdit(e, msg.id, msg.text)}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-default"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <div className="w-px h-4 bg-border" />
                      <button
                        onClick={(e) => handleDelete(e, msg.id)}
                        disabled={deleteMessage.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-default"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar — unchanged */}
      <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 pb-safe">
        <div className="flex gap-2">
          <Input
            placeholder={isOnline ? "Type a message..." : "Offline"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isOnline}
            className="flex-1"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending || !isOnline}
            className="touch-target h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-default hover:opacity-90 disabled:opacity-50"
          >
            {sendMessage.isPending ? (
              <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}