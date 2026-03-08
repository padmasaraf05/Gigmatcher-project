import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  size?: number;
  className?: string;
}

export default function StarRating({ rating, interactive = false, onRate, size = 20, className }: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRate?.(star)}
          className={cn(
            "transition-default",
            interactive ? "touch-target cursor-pointer hover:scale-110" : "cursor-default p-0"
          )}
          style={{ minHeight: interactive ? 44 : undefined, minWidth: interactive ? 44 : undefined }}
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              "transition-default",
              star <= rating
                ? "fill-secondary text-secondary"
                : "fill-none text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}
