// src/pages/worker/WorkerDashboard.tsx
// BUGFIX: Toggle now reads from and writes to DB via useUpdateAvailability.
// Changes marked [FIX] — all JSX/layout/Tailwind IDENTICAL to original.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkerDashboard, useUpdateAvailability } from "@/hooks/useWorkerApi"; // [FIX] added useUpdateAvailability
import { useAuth } from "@/context/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IndianRupee, Briefcase, Star, AlertTriangle, ChevronRight, User,
} from "lucide-react";

export default function WorkerDashboard() {
  const { data, isLoading } = useWorkerDashboard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const updateAvailability = useUpdateAvailability(); // [FIX] added

  // [FIX] Default false (safe while loading). Synced from DB once data arrives.
  const [available, setAvailable] = useState(false);

  // [FIX] Sync local state from DB value whenever hook data loads/refreshes.
  // Without this, remounting always resets to the useState default.
  useEffect(() => {
    if (data?.isAvailable !== undefined) {
      setAvailable(data.isAvailable);
    }
  }, [data?.isAvailable]);

  // [FIX] Toggle handler: optimistic UI update + real DB write.
  const handleToggle = (next: boolean) => {
    setAvailable(next); // optimistic — instant UI response
    updateAvailability.mutate(next); // persist to worker_profiles.is_available
  };

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-xl" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const stats = data?.stats;
  const statCards = [
    { label: "Today", value: `₹${stats?.todayEarnings}`, icon: IndianRupee, color: "text-accent" },
    { label: "This Week", value: `₹${stats?.weekEarnings}`, icon: IndianRupee, color: "text-primary" },
    { label: "Active Jobs", value: `${stats?.activeJobs}`, icon: Briefcase, color: "text-secondary" },
    { label: "Rating", value: `${stats?.rating} ★`, icon: Star, color: "text-yellow-500" },
  ];

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in-up">
      {/* Profile header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {user?.name || data?.workerName || "Worker"}
            </h2>
            <span className={`text-xs font-semibold ${available ? "text-accent" : "text-muted-foreground"}`}>
              {available ? "● Available" : "● Offline"}
            </span>
          </div>
        </div>
        {/* [FIX] onCheckedChange now calls handleToggle instead of bare setAvailable */}
        <Switch checked={available} onCheckedChange={handleToggle} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Demand Alert */}
      {data?.demandAlert && (
        <div className="rounded-xl bg-secondary/10 border border-secondary/30 p-3.5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-foreground">{data.demandAlert}</p>
        </div>
      )}

      {/* Active Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground">Active Jobs</h3>
          <button
            onClick={() => navigate("/worker/jobs")}
            className="text-sm font-semibold text-primary flex items-center gap-0.5"
          >
            View All <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {data?.activeJobs.map((job) => (
            <button
              key={job.id}
              onClick={() => navigate(`/worker/job/${job.id}`)}
              className="w-full rounded-xl border border-border bg-card p-4 text-left transition-default hover:border-primary/30 active:scale-[0.99]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-foreground">{job.customerName}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  job.status === "active"
                    ? "bg-accent/10 text-accent"
                    : "bg-secondary/10 text-secondary"
                }`}>
                  {job.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{job.serviceType}</span>
                <span>•</span>
                <span>{job.distance}</span>
                <span>•</span>
                <span className="font-semibold text-foreground">₹{job.payment}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}