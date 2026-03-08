import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkerJobs, type Job } from "@/hooks/useWorkerApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Inbox, ChevronRight } from "lucide-react";

const FILTERS = ["pending", "active", "completed"] as const;

export default function WorkerJobs() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const { data: jobs, isLoading, refetch, isFetching } = useWorkerJobs(filter);
  const navigate = useNavigate();
  const [pulling, setPulling] = useState(false);

  const handleRefresh = useCallback(async () => {
    setPulling(true);
    await refetch();
    setPulling(false);
  }, [refetch]);

  const urgencyChip = (u: Job["urgency"]) => {
    if (u === "urgent") return "bg-destructive/10 text-destructive";
    if (u === "scheduled") return "bg-primary/10 text-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="px-4 py-5 space-y-4 animate-fade-in">
      <h2 className="text-xl font-bold text-foreground">Jobs</h2>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 touch-target rounded-lg py-2.5 text-sm font-semibold capitalize transition-default ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Pull to refresh */}
      {(pulling || isFetching) && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => navigate(`/worker/job/${job.id}`)}
              className="w-full rounded-xl border border-border bg-card p-4 text-left transition-default hover:border-primary/30 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {job.customerName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-foreground block truncate">
                    {job.customerName}
                  </span>
                  <span className="text-xs text-muted-foreground">{job.serviceType}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgencyChip(job.urgency)}`}>
                  {job.urgency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{job.distance}</span>
                  <span>•</span>
                  <span className="font-semibold text-foreground">₹{job.payment}</span>
                  <span>•</span>
                  <span>{job.postedAt}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-1">No jobs yet</h3>
          <p className="text-sm text-muted-foreground">Set yourself as available to start receiving jobs!</p>
        </div>
      )}

      {/* Manual refresh */}
      <button
        onClick={handleRefresh}
        disabled={isFetching}
        className="touch-target w-full rounded-lg border border-border py-3 text-sm font-medium text-muted-foreground transition-default hover:bg-muted"
      >
        {isFetching ? "Refreshing..." : "Refresh Jobs"}
      </button>
    </div>
  );
}
