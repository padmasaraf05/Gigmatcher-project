// src/pages/customer/WorkerSelection.tsx
// [FIX Issue 4] Worker photo was never rendered in the card avatar.
//   OLD: always showed {worker.name.charAt(0)} initial letter
//   FIX: shows <img> when worker.photo is a non-empty string,
//        falls back to initial letter if photo is missing.
//   Container div: identical size/shape (h-12 w-12 rounded-full).
//   All other JSX, Tailwind classes, logic — IDENTICAL to previous version.

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAvailableWorkers, useBookJob } from "@/hooks/useCustomerApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, Check, AlertTriangle, Map, List } from "lucide-react";
import LoadingButton from "@/components/LoadingButton";
import { toast } from "@/hooks/use-toast";

const SORT_OPTIONS = [
  { key: "rating",   label: "Rating" },
  { key: "distance", label: "Distance" },
  { key: "price",    label: "Price" },
];

interface BookFormState {
  category?: string;
  description?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  date?: string;
  timeSlot?: string;
  urgency?: "normal" | "urgent";
  selectedTools?: string[];
  budget?: number | null;
  photoUrls?: string[];
}

export default function WorkerSelection() {
  const [sort, setSort] = useState("rating");
  const [mapView, setMapView] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const formState = (location.state as BookFormState | null) ?? {};

  const { data: workers, isLoading, refetch, isFetching } =
    useAvailableWorkers({
      sort,
      categorySlug:  formState.category   ?? null,
      requiredTools: formState.selectedTools ?? [],
      customerLat:   formState.latitude    ?? null,
      customerLng:   formState.longitude   ?? null,
    });

  const bookJob = useBookJob();

  const handleBook = async (workerId: string, workerName: string) => {
    if (!formState.category) {
      toast({ title: "No service selected", description: "Please go back and fill the form again." });
      return;
    }

    await bookJob.mutateAsync({
      workerId,
      categorySlug:  formState.category,
      description:   formState.description  ?? "",
      address:       formState.address       ?? "",
      latitude:      formState.latitude      ?? null,
      longitude:     formState.longitude     ?? null,
      date:          formState.date          ?? "",
      timeSlot:      formState.timeSlot      ?? "",
      urgency:       formState.urgency       ?? "normal",
      requiredTools: formState.selectedTools ?? [],
      budget:        formState.budget        ?? null,
      photoUrls:     formState.photoUrls     ?? [],
    });

    toast({
      title: "Job sent to worker!",
      description: `${workerName} will review and accept your job shortly.`,
    });
    navigate("/customer/bookings");
  };

  // ── UI — IDENTICAL TO ORIGINAL ────────────────────────────────────────────
  return (
    <div className="px-4 py-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Available Workers</h2>
        <button
          onClick={() => setMapView((v) => !v)}
          className="touch-target flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-default hover:bg-muted"
        >
          {mapView ? <List className="h-4 w-4" /> : <Map className="h-4 w-4" />}
          {mapView ? "List" : "Map"}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSort(opt.key)}
            className={`flex-1 touch-target rounded-lg py-2.5 text-xs font-semibold transition-default ${
              sort === opt.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Map View */}
      {mapView ? (
        <div className="relative h-72 rounded-xl bg-muted border border-border flex items-center justify-center">
          <MapPin className="h-10 w-10 text-primary" />
          <div className="absolute top-3 left-3 space-y-1">
            {workers?.slice(0, 3).map((w) => (
              <div key={w.id} className="bg-card rounded-lg px-2 py-1 text-xs font-semibold shadow-sm border border-border">
                📍 {w.name} ({w.distance})
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : workers && workers.length > 0 ? (
        <div className="space-y-3">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="rounded-xl border border-border bg-card p-4 transition-default"
            >
              <div className="flex items-start gap-3 mb-3">
                {/* [FIX Issue 4] Show photo if available, initial letter fallback */}
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-base font-bold text-muted-foreground shrink-0 overflow-hidden">
                  {worker.photo ? (
                    <img src={worker.photo} alt={worker.name} className="h-full w-full object-cover" />
                  ) : (
                    worker.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-foreground">{worker.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      <span className="text-xs font-semibold text-foreground">{worker.rating}</span>
                      <span className="text-xs text-muted-foreground">({worker.reviewCount})</span>
                    </div>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{worker.distance}</span>
                  </div>
                </div>
                <span className="text-base font-bold text-foreground">
                  {formState.budget
                    ? `₹${formState.budget} budget`
                    : worker.rate > 0
                      ? `₹${worker.rate}/hr`
                      : "Rate TBD"}
                </span>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {worker.skills.map((s) => (
                  <span key={s} className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">
                    {s}
                  </span>
                ))}
              </div>

              {/* Tool availability */}
              <div className={`flex items-center gap-1.5 mb-3 text-xs font-semibold ${
                worker.hasAllTools ? "text-accent" : "text-secondary"
              }`}>
                {worker.hasAllTools ? (
                  <><Check className="h-3.5 w-3.5" /> Has all tools</>
                ) : (
                  <><AlertTriangle className="h-3.5 w-3.5" /> Missing {worker.missingToolCount} tool{worker.missingToolCount > 1 ? "s" : ""}</>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/customer/worker/${worker.id}`, {
                    state: formState,
                  })}
                  className="flex-1 touch-target rounded-lg border-2 border-border py-2.5 text-xs font-semibold text-foreground transition-default hover:bg-muted"
                >
                  View Profile
                </button>
                <LoadingButton
                  variant="primary"
                  className="flex-1 !text-sm !py-2.5"
                  loading={bookJob.isPending}
                  onClick={() => handleBook(worker.id, worker.name)}
                >
                  Book Now
                </LoadingButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-14 text-center">
          <MapPin className="h-14 w-14 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground mb-1">No workers available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {formState.category
              ? "No workers with matching skills are available right now."
              : "Try expanding your area or adjusting filters"}
          </p>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="touch-target rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-default hover:opacity-90"
          >
            {isFetching ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
}