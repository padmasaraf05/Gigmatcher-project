import { JOB_STATUS_CONFIG, TIMELINE_STEPS, type JobStatus } from "@/lib/jobStateMachine";
import { Check } from "lucide-react";

interface StatusChipProps {
  status: JobStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  const config = JOB_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 ${config.chipClass}`}>
      {config.label}
    </span>
  );
}

interface StatusTimelineProps {
  status: JobStatus;
}

export function StatusTimeline({ status }: StatusTimelineProps) {
  const currentStep = JOB_STATUS_CONFIG[status]?.timelineStep ?? 0;
  const isCancelled = status === "cancelled" || status === "declined";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold text-foreground mb-3">Status</h3>
      <div className="flex items-start justify-between">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i <= currentStep && !isCancelled;
          const active = i === currentStep && !isCancelled;
          return (
            <div key={step} className="flex flex-col items-center flex-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                done ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              } ${active ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""}`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={`text-[10px] mt-1.5 text-center leading-tight ${
                done ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <p className="text-xs text-destructive font-semibold mt-3 text-center">
          This job was {status}
        </p>
      )}
    </div>
  );
}
