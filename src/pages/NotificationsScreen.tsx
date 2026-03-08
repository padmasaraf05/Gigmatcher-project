import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, useMarkAllRead, useMarkRead, useDismissNotification, useClearAll, AppNotification } from "@/hooks/useNotifications";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Briefcase, DollarSign, BellRing, Check, Trash2, ArrowLeft, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "job", label: "Jobs" },
  { key: "payment", label: "Payments" },
  { key: "system", label: "System" },
];

const TYPE_ICON: Record<string, { icon: typeof Bell; bg: string; color: string }> = {
  job: { icon: Briefcase, bg: "bg-primary/10", color: "text-primary" },
  payment: { icon: DollarSign, bg: "bg-accent/10", color: "text-accent" },
  system: { icon: BellRing, bg: "bg-secondary/10", color: "text-secondary" },
};

export default function NotificationsScreen() {
  const [filter, setFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications(filter);
  const markAllRead = useMarkAllRead();
  const markRead = useMarkRead();
  const dismiss = useDismissNotification();
  const clearAll = useClearAll();

  const handleTap = (n: AppNotification) => {
    markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="app-shell min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Notifications</h1>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-48 rounded-xl bg-card border border-border shadow-lg py-1">
                <button
                  onClick={() => { markAllRead.mutate(); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-muted transition-default"
                >
                  <Check className="h-4 w-4" /> Mark all read
                </button>
                <button
                  onClick={() => { clearAll.mutate(); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-default"
                >
                  <Trash2 className="h-4 w-4" /> Clear all
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-default ${
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-4 pb-20">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : !notifications?.length ? (
          <EmptyState
            icon={<Bell className="h-16 w-16" />}
            title="You're all caught up!"
            subtitle="No notifications right now."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onTap={handleTap} onDismiss={(id) => dismiss.mutate(id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationItem({
  notification: n,
  onTap,
  onDismiss,
}: {
  notification: AppNotification;
  onTap: (n: AppNotification) => void;
  onDismiss: (id: string) => void;
}) {
  const touchStartX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const typeConfig = TYPE_ICON[n.type] ?? TYPE_ICON.system;
  const Icon = typeConfig.icon;

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.touches[0].clientX;
    if (diff > 0) setOffset(Math.min(diff, 120));
  };
  const handleTouchEnd = () => {
    if (offset > 80) { setDismissed(true); setTimeout(() => onDismiss(n.id), 300); }
    else setOffset(0);
  };

  return (
    <div
      className={`transition-all duration-300 ${dismissed ? "opacity-0 -translate-x-full h-0 overflow-hidden" : ""}`}
    >
      <button
        onClick={() => onTap(n)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full text-left rounded-xl p-3.5 flex gap-3 transition-default ${
          n.read ? "bg-card" : "bg-primary/5 border-l-4 border-primary"
        }`}
        style={{ transform: `translateX(-${offset}px)`, opacity: 1 - offset / 200 }}
      >
        <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${typeConfig.bg}`}>
          <Icon className={`h-5 w-5 ${typeConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${n.read ? "text-foreground" : "font-semibold text-foreground"}`}>
            {n.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            {formatDistanceToNow(n.timestamp, { addSuffix: true })}
          </p>
        </div>
      </button>
    </div>
  );
}
