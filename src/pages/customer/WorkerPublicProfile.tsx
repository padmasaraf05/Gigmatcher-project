// src/pages/customer/WorkerPublicProfile.tsx
// POLISH:
//   [POLISH 3] Removed Portfolio section entirely
//   [POLISH 1] Passes budget + photoUrls from form state to useBookJob
// ALL other JSX, Tailwind classes, UI elements — IDENTICAL to original.

import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useWorkerPublicProfile, useBookJob } from "@/hooks/useCustomerApi";
import { Skeleton } from "@/components/ui/skeleton";
import LoadingButton from "@/components/LoadingButton";
import { Star, Check, Flag } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const DAY_LABELS = ["Today", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface BookFormState {
  category?:      string;
  description?:   string;
  address?:       string;
  latitude?:      number | null;
  longitude?:     number | null;
  date?:          string;
  timeSlot?:      string;
  urgency?:       "normal" | "urgent";
  selectedTools?: string[];
  budget?:        number | null;    // [POLISH 1]
  photoUrls?:     string[];         // [POLISH 1]
}

export default function WorkerPublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const formState     = (location.state as BookFormState | null) ?? {};
  const hasJobContext = !!formState.category;

  const { data: worker, isLoading } = useWorkerPublicProfile(id || "");
  const bookJob = useBookJob();
  const [showReport, setShowReport] = useState(false);

  const handleBook = async () => {
    if (!hasJobContext) {
      navigate("/customer/book");
      return;
    }
    if (!worker) return;

    await bookJob.mutateAsync({
      workerId:      worker.id,
      categorySlug:  formState.category    ?? "",
      description:   formState.description ?? "",
      address:       formState.address     ?? "",
      latitude:      formState.latitude    ?? null,
      longitude:     formState.longitude   ?? null,
      date:          formState.date        ?? "",
      timeSlot:      formState.timeSlot    ?? "",
      urgency:       formState.urgency     ?? "normal",
      requiredTools: formState.selectedTools ?? [],
      budget:        formState.budget      ?? null,    // [POLISH 1]
      photoUrls:     formState.photoUrls   ?? [],      // [POLISH 1]
    });

    toast({
      title: "Job sent to worker!",
      description: `${worker.name} will review and accept your job shortly.`,
    });
    navigate("/customer/bookings");
  };

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (!worker) {
    return <div className="px-4 py-10 text-center"><p className="text-muted-foreground">Worker not found</p></div>;
  }

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in pb-28">
      {/* Hero */}
      <div className="relative text-center">
        <button
          onClick={() => setShowReport(true)}
          className="absolute top-0 right-0 touch-target p-2 rounded-full hover:bg-muted transition-default"
        >
          <Flag className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="mx-auto h-24 w-24 rounded-full bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground mb-3">
          {worker.photo
            ? <img src={worker.photo} alt={worker.name} className="h-full w-full object-cover rounded-full" />
            : worker.name.charAt(0)
          }
        </div>
        <h2 className="text-xl font-bold text-foreground">{worker.name}</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <div className="flex items-center gap-0.5">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
            <span className="text-sm font-bold text-foreground">{worker.rating}</span>
          </div>
          <span className="text-sm text-muted-foreground">|</span>
          <span className="text-sm text-muted-foreground">{worker.reviewCount} reviews</span>
        </div>
        {worker.available && (
          <span className="mt-2 inline-block rounded-full bg-accent/10 text-accent px-3 py-1 text-xs font-semibold">
            ● Available Now
          </span>
        )}
      </div>

      {/* Skills */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">Skills</h3>
        <div className="flex flex-wrap gap-2">
          {worker.skills.map((s) => (
            <span key={s} className="rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold">{s}</span>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">Tools Available</h3>
        <div className="space-y-1.5">
          {worker.tools.map((tool) => (
            <div key={tool} className="flex items-center gap-2 text-sm text-foreground">
              <Check className="h-4 w-4 text-accent" />
              <span>{tool}</span>
            </div>
          ))}
        </div>
      </div>

      {/* [POLISH 3] Portfolio section REMOVED */}

      {/* Availability Calendar */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">This Week</h3>
        <div className="flex gap-2">
          {DAY_LABELS.map((day, i) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1.5 py-2">
              <span className="text-xs text-muted-foreground">{day}</span>
              <div className={`h-3 w-3 rounded-full ${
                worker.availableDays[i] ? "bg-accent" : "bg-muted-foreground/30"
              }`} />
            </div>
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Reviews</h3>
        {worker.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          worker.reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-foreground">{review.customerName}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
              <p className="text-xs text-muted-foreground/60 mt-1.5">{review.date}</p>
            </div>
          ))
        )}
      </div>

      {/* Sticky Bottom */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-card border-t border-border px-4 py-3 z-20">
        <LoadingButton loading={bookJob.isPending} onClick={handleBook}>
          {hasJobContext ? "Book This Worker" : "Book a Service First"}
        </LoadingButton>
      </div>

      {/* Report Sheet */}
      {showReport && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/30 animate-fade-in" onClick={() => setShowReport(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border p-5 animate-slide-in-bottom">
            <h3 className="text-base font-bold text-foreground mb-2">Report Worker</h3>
            <p className="text-sm text-muted-foreground mb-4">Are you sure you want to report this worker? Our team will review the report.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 touch-target rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-default hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowReport(false);
                  toast({ title: "Report submitted", description: "We'll review this within 24 hours" });
                }}
                className="flex-1 touch-target rounded-lg bg-destructive py-3 text-sm font-semibold text-destructive-foreground transition-default hover:opacity-90"
              >
                Report
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}