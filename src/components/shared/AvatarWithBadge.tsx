import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface AvatarWithBadgeProps {
  src?: string;
  name: string;
  badge?: "pro" | "online" | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = { sm: "h-8 w-8", md: "h-12 w-12", lg: "h-20 w-20" };

export default function AvatarWithBadge({ src, name, badge, size = "md", className }: AvatarWithBadgeProps) {
  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div className={cn("rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-card", SIZE_MAP[size])}>
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <User className={cn("text-muted-foreground", size === "lg" ? "h-8 w-8" : "h-5 w-5")} />
        )}
      </div>
      {badge === "pro" && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-secondary text-secondary-foreground text-[9px] font-bold px-1.5 py-0.5 leading-none">
          PRO
        </span>
      )}
      {badge === "online" && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-accent border-2 border-card" />
      )}
    </div>
  );
}
