import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { bg: string; text: string; label?: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Pending" },
  accepted: { bg: "bg-primary/10", text: "text-primary", label: "Accepted" },
  en_route: { bg: "bg-secondary/10", text: "text-secondary", label: "En Route" },
  in_progress: { bg: "bg-accent/10", text: "text-accent", label: "In Progress" },
  completed: { bg: "bg-muted", text: "text-muted-foreground", label: "Completed" },
  declined: { bg: "bg-destructive/10", text: "text-destructive", label: "Declined" },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", label: "Cancelled" },
  paid: { bg: "bg-accent/10", text: "text-accent", label: "Paid" },
  processing: { bg: "bg-primary/10", text: "text-primary", label: "Processing" },
  failed: { bg: "bg-destructive/10", text: "text-destructive", label: "Failed" },
  active: { bg: "bg-accent/10", text: "text-accent", label: "Active" },
  free: { bg: "bg-muted", text: "text-muted-foreground", label: "Free Plan" },
  pro: { bg: "bg-secondary/10", text: "text-secondary", label: "Pro ✓" },
};

interface StatusChipProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

export default function StatusChip({ status, size = "sm", className }: StatusChipProps) {
  const config = STATUS_MAP[status.toLowerCase()] ?? { bg: "bg-muted", text: "text-muted-foreground" };
  const label = config.label ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        config.bg,
        config.text,
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      {label}
    </span>
  );
}
