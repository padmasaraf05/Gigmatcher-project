import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerBookings, type Booking } from "@/hooks/useCustomerApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Inbox, ChevronRight } from "lucide-react";

const TABS = ["active", "pending", "completed", "cancelled"] as const;
type Tab = (typeof TABS)[number];

export default function CustomerBookings() {
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const { data: bookings, isLoading } = useCustomerBookings(tab);
  const navigate = useNavigate();

  const filtered = bookings?.filter(
    (b) =>
      b.workerName.toLowerCase().includes(search.toLowerCase()) ||
      b.serviceType.toLowerCase().includes(search.toLowerCase())
  );

  const statusChip = (s: Booking["status"]) => {
    const map: Record<string, string> = {
      pending: "bg-secondary/10 text-secondary",
      accepted: "bg-primary/10 text-primary",
      en_route: "bg-accent/10 text-accent",
      in_progress: "bg-accent/10 text-accent",
      completed: "bg-accent/10 text-accent",
      cancelled: "bg-destructive/10 text-destructive",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="px-4 py-5 space-y-4 animate-fade-in">
      <h2 className="text-xl font-bold text-foreground">My Bookings</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bookings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 touch-target rounded-lg py-2 text-xs font-semibold capitalize transition-default ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <button
              key={booking.id}
              onClick={() => navigate(`/customer/booking/${booking.id}`)}
              className="w-full rounded-xl border border-border bg-card p-4 text-left transition-default hover:border-primary/30 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                  {booking.workerName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-foreground block truncate">{booking.workerName}</span>
                  <span className="text-xs text-muted-foreground">{booking.serviceType}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusChip(booking.status)}`}>
                  {booking.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{booking.date} • {booking.time}</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-foreground">₹{booking.payment}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>

              {/* Status-specific actions hint */}
              <div className="mt-2.5 flex gap-2">
                {booking.status === "pending" && (
                  <>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Reschedule</span>
                    <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">Cancel</span>
                  </>
                )}
                {(booking.status === "en_route" || booking.status === "in_progress" || booking.status === "accepted") && (
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Track Live</span>
                )}
                {booking.status === "completed" && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Rate & Review</span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-14 text-center">
          <Inbox className="h-14 w-14 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground mb-1">No {tab} bookings</h3>
          <p className="text-sm text-muted-foreground">
            {tab === "active" ? "You have no active bookings right now" : `No ${tab} bookings found`}
          </p>
        </div>
      )}
    </div>
  );
}
