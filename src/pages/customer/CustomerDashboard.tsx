import { useNavigate } from "react-router-dom";
import { useCustomerDashboard } from "@/hooks/useCustomerApi";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight, Star, Clock, Inbox,
} from "lucide-react";

const QUICK_SERVICES = [
  { id: "plumber", label: "Plumber", icon: "🔧" },
  { id: "electrician", label: "Electrician", icon: "⚡" },
  { id: "carpenter", label: "Carpenter", icon: "🪚" },
  { id: "tailor", label: "Tailor", icon: "🧵" },
  { id: "mechanic", label: "Mechanic", icon: "🔩" },
  { id: "painter", label: "Painter", icon: "🎨" },
];

export default function CustomerDashboard() {
  const { data, isLoading } = useCustomerDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-20 shrink-0 rounded-xl" />)}
        </div>
        {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  const activeBookings = data?.activeBookings || [];
  const recentWorkers = data?.recentWorkers || [];

  return (
    <div className="px-4 py-5 space-y-6 animate-fade-in-up">
      {/* Hero CTA */}
      <button
        onClick={() => navigate("/customer/book")}
        className="w-full rounded-2xl bg-secondary p-5 text-left transition-default hover:opacity-95 active:scale-[0.99]"
      >
        <h2 className="text-xl font-bold text-secondary-foreground">Book a Service</h2>
        <p className="text-sm text-secondary-foreground/80 mt-1">500+ verified workers nearby</p>
      </button>

      {/* Quick Services */}
      <div>
        <h3 className="text-base font-bold text-foreground mb-3">Quick Services</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {QUICK_SERVICES.map((svc) => (
            <button
              key={svc.id}
              onClick={() => navigate(`/customer/book?category=${svc.id}`)}
              className="touch-target shrink-0 w-20 flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 transition-default hover:border-primary/40 active:scale-[0.97]"
            >
              <span className="text-2xl">{svc.icon}</span>
              <span className="text-xs font-semibold text-foreground">{svc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground">Active Bookings</h3>
          <button
            onClick={() => navigate("/customer/bookings")}
            className="text-sm font-semibold text-primary flex items-center gap-0.5"
          >
            View All <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {activeBookings.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Inbox className="h-14 w-14 text-muted-foreground/40 mb-3" />
            <h4 className="text-base font-bold text-foreground mb-1">No active bookings</h4>
            <p className="text-sm text-muted-foreground">Book your first service!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeBookings.map((booking) => (
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
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    booking.status === "en_route" ? "bg-accent/10 text-accent" : "bg-secondary/10 text-secondary"
                  }`}>
                    {booking.status.replace("_", " ")}
                  </span>
                </div>
                {booking.eta && (
                  <div className="flex items-center gap-1.5 text-xs text-accent font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    <span>ETA: {booking.eta}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Workers */}
      {recentWorkers.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-foreground mb-3">Recent Workers</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {recentWorkers.map((worker) => (
              <button
                key={worker.id}
                onClick={() => navigate(`/customer/worker/${worker.id}`)}
                className="shrink-0 w-28 rounded-xl border border-border bg-card p-3 text-center transition-default hover:border-primary/30 active:scale-[0.97]"
              >
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground mb-2">
                  {worker.name.charAt(0)}
                </div>
                <p className="text-xs font-bold text-foreground truncate">{worker.name}</p>
                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">{worker.rating}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
