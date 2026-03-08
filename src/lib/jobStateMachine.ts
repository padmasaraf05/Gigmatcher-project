// Job Status State Machine for GigMatcher

export type JobStatus =
  | "pending"
  | "accepted"
  | "en_route"
  | "in_progress"
  | "completed"
  | "declined"
  | "cancelled";

export const JOB_STATUS_CONFIG: Record<
  JobStatus,
  {
    label: string;
    chipClass: string;
    timelineStep: number;
  }
> = {
  pending: {
    label: "Pending",
    chipClass: "bg-yellow-100 text-yellow-800",
    timelineStep: 0,
  },
  accepted: {
    label: "Accepted",
    chipClass: "bg-primary/10 text-primary",
    timelineStep: 1,
  },
  en_route: {
    label: "En Route",
    chipClass: "bg-secondary/10 text-secondary",
    timelineStep: 2,
  },
  in_progress: {
    label: "In Progress",
    chipClass: "bg-accent/10 text-accent",
    timelineStep: 3,
  },
  completed: {
    label: "Completed",
    chipClass: "bg-muted text-muted-foreground",
    timelineStep: 4,
  },
  declined: {
    label: "Declined",
    chipClass: "bg-destructive/10 text-destructive",
    timelineStep: -1,
  },
  cancelled: {
    label: "Cancelled",
    chipClass: "bg-destructive/10 text-destructive",
    timelineStep: -1,
  },
};

export const TIMELINE_STEPS = ["Pending", "Accepted", "En Route", "In Progress", "Completed"];

// Valid transitions
const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending: ["accepted", "declined", "cancelled"],
  accepted: ["en_route", "cancelled"],
  en_route: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  declined: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatus(current: JobStatus): JobStatus | null {
  const order: JobStatus[] = ["pending", "accepted", "en_route", "in_progress", "completed"];
  const idx = order.indexOf(current);
  if (idx === -1 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

export function getStatusToastMessage(status: JobStatus): string {
  const messages: Record<JobStatus, string> = {
    pending: "Job is pending",
    accepted: "Job accepted! 🎉",
    en_route: "Worker is now en route! 🚗",
    in_progress: "Job has started! 🔧",
    completed: "Job completed! ✅",
    declined: "Job was declined",
    cancelled: "Job was cancelled",
  };
  return messages[status];
}
