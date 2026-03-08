// src/pages/worker/WorkerJobDetail.tsx
// POLISH:
//   [POLISH 5] CountdownRing timer changed from 60s → 300s (5 minutes)
//   [POLISH 1a] Payment section shows "Customer Budget" instead of "Cash on completion"
//   [POLISH 1b] Shows customer-uploaded photos if any
// ALL other JSX structure, Tailwind classes, layout — IDENTICAL to original.

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJobDetail, useWorkerProfile, type Job } from "@/hooks/useWorkerApi";
import { useJobStatusPolling, useJobStatusMutation } from "@/hooks/useJobLifecycle";
import { type JobStatus } from "@/lib/jobStateMachine";
import { StatusChip } from "@/components/StatusComponents";
import LiveLocationMap from "@/components/LiveLocationMap";
import CountdownRing from "@/components/CountdownRing";
import WorkerJobCompletion from "@/components/WorkerJobCompletion";
import { Skeleton } from "@/components/ui/skeleton";
import LoadingButton from "@/components/LoadingButton";
import {
  Star, Phone, MapPin, Check, X, MessageCircle, Navigation, ChevronLeft, ImageIcon,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function WorkerJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useJobDetail(id || "");

  const { data: workerProfile } = useWorkerProfile();
  const workerTools = workerProfile?.tools.map((t) => t.tool_name) ?? [];

  const statusMutation = useJobStatusMutation();

  const initialStatus: JobStatus = job?.status === "active" ? "accepted" : (job?.status as JobStatus) || "pending";
  const { data: polledStatus }   = useJobStatusPolling(id || "", initialStatus);
  const [localStatus, setLocalStatus] = useState<JobStatus | null>(null);

  const status: JobStatus = localStatus || polledStatus || initialStatus;

  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  useEffect(() => {
    if (polledStatus && !localStatus) {
      // sync only if not locally overridden
    }
  }, [polledStatus, localStatus]);

  const handleStatusUpdate = async (newStatus: JobStatus) => {
    await statusMutation.mutateAsync({ jobId: id!, status: newStatus });
    setLocalStatus(newStatus);
    if (newStatus === "completed") {
      navigate(`/rate/${id}`, { replace: true });
    }
  };

  const handleCountdownComplete = useCallback(() => {
    toast({ title: "Job reassigned", description: "Response time expired" });
    navigate("/worker/jobs", { replace: true });
  }, [navigate]);

  const handleDecline = async () => {
    setShowDeclineConfirm(false);
    await statusMutation.mutateAsync({ jobId: id!, status: "declined" });
    setLocalStatus("declined");
    navigate("/worker/jobs", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  const isLiveTracking = status === "en_route" || status === "in_progress";

  // [POLISH 1b] photos from job
  const photoUrls: string[] = (job as Job & { photoUrls?: string[] }).photoUrls ?? [];

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in pb-32">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="touch-target flex items-center gap-1 text-sm font-semibold text-primary"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      {/* Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Job Details</h3>
        <StatusChip status={status} />
      </div>

      {/* Customer Card */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
          {job.customerName.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">{job.customerName}</h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
            <span>{job.customerRating}</span>
          </div>
        </div>
        <button className="touch-target h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center transition-default hover:bg-primary/20">
          <Phone className="h-5 w-5 text-primary" />
        </button>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Job Description</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{job.description}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">{job.serviceType}</span>
          <span>{job.distance}</span>
          <span>•</span>
          <span>{job.postedAt}</span>
        </div>
      </div>

      {/* [POLISH 1b] Customer photos */}
      {photoUrls.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            Photos from Customer
          </h4>
          <div className="flex gap-2 flex-wrap">
            {photoUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-24 w-24 rounded-xl overflow-hidden border border-border block"
              >
                <img src={url} alt={`Job photo ${i + 1}`} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Live Location Map */}
      {isLiveTracking ? (
        <LiveLocationMap jobId={id!} isTracking={true} address={job.address} />
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-foreground">Location</h4>
          <div className="relative h-36 rounded-xl bg-muted border border-border flex items-center justify-center">
            <MapPin className="h-8 w-8 text-primary" />
            <span className="absolute bottom-2 left-3 bg-card rounded-lg px-3 py-1 text-xs font-medium text-foreground shadow-sm border border-border">
              📍 {job.address}
            </span>
          </div>
          <button className="touch-target w-full flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-semibold text-primary transition-default hover:bg-primary/5">
            <Navigation className="h-4 w-4" /> Get Directions
          </button>
        </div>
      )}

      {/* [POLISH 1a] Customer Budget — replaces "Cash on completion" */}
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-3xl font-bold text-foreground">₹{job.payment}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {job.payment > 0 ? "Customer's budget" : "Price to be negotiated"}
        </p>
      </div>

      {/* Tools Required */}
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Tools Required</h4>
        <div className="space-y-2">
          {job.toolsRequired.map((tool) => {
            const hasTool = workerTools.map((t) => t.toLowerCase()).includes(tool.toLowerCase());
            return (
              <div key={tool} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
                  hasTool ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {hasTool ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </div>
                <span className="text-sm text-foreground">{tool}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-card border-t border-border px-4 py-3 space-y-2 z-20">
        {status === "pending" && (
          <>
            <div className="flex items-center justify-center gap-3 mb-1">
              {/* [POLISH 5] Timer changed from 60s → 300s (5 minutes) */}
              <CountdownRing seconds={300} total={300} onComplete={handleCountdownComplete} />
            </div>
            <div className="flex gap-3">
              <LoadingButton
                variant="outline"
                className="flex-1 !border-destructive !text-destructive"
                loading={statusMutation.isPending}
                onClick={() => setShowDeclineConfirm(true)}
              >
                Decline
              </LoadingButton>
              <LoadingButton
                className="flex-1 !bg-accent"
                loading={statusMutation.isPending}
                onClick={() => handleStatusUpdate("accepted")}
              >
                Accept Job
              </LoadingButton>
            </div>
          </>
        )}
        {status === "accepted" && (
          <LoadingButton loading={statusMutation.isPending} onClick={() => handleStatusUpdate("en_route")}>
            Mark En Route
          </LoadingButton>
        )}
        {status === "en_route" && (
          <LoadingButton loading={statusMutation.isPending} onClick={() => handleStatusUpdate("in_progress")}>
            Job Started
          </LoadingButton>
        )}
        {status === "in_progress" && (
          <WorkerJobCompletion
            loading={statusMutation.isPending}
            onComplete={() => handleStatusUpdate("completed")}
          />
        )}

        <button
          onClick={() => navigate(`/messages/${id}`)}
          className="touch-target w-full flex items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-default hover:bg-muted"
        >
          <MessageCircle className="h-4 w-4" /> Chat with Customer
        </button>
      </div>

      {/* Decline Confirmation */}
      {showDeclineConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/30 animate-fade-in" onClick={() => setShowDeclineConfirm(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border p-5 animate-slide-up">
            <h3 className="text-base font-bold text-foreground mb-2">Decline Job?</h3>
            <p className="text-sm text-muted-foreground mb-4">This job will be cancelled. Declining too many jobs may affect your rating.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeclineConfirm(false)}
                className="flex-1 touch-target rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-default hover:bg-muted"
              >
                Keep
              </button>
              <LoadingButton
                variant="primary"
                className="flex-1 !bg-destructive"
                loading={statusMutation.isPending}
                onClick={handleDecline}
              >
                Decline
              </LoadingButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}