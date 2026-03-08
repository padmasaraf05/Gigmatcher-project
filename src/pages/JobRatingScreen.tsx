// src/pages/JobRatingScreen.tsx
// PHASE 8:
//   handleSubmit() was a mock (setTimeout + navigate).
//   Now calls useSubmitReview() (customer→worker) or useSubmitWorkerReview()
//   (worker→customer) with real Supabase INSERT.
//   Job is fetched by jobId to resolve the reviewee's identity.
//   ALL JSX, Tailwind classes, layout, CATEGORIES — IDENTICAL to original.

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSubmitReview } from "@/hooks/useCustomerApi";
import { useSubmitWorkerReview } from "@/hooks/useWorkerApi";
import { Textarea } from "@/components/ui/textarea";
import LoadingButton from "@/components/LoadingButton";
import { Star, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = ["Quality of Work", "Punctuality", "Communication", "Value for Money"];

export default function JobRatingScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();

  // Customer reviews worker — from BookingDetail or after job completion
  const submitCustomerReview = useSubmitReview();
  // Worker reviews customer — from WorkerJobDetail after marking complete
  const submitWorkerReview   = useSubmitWorkerReview();

  const [rating, setRating] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const ratingTarget = role === "worker" ? "Customer" : "Worker";
  const isLoading = submitCustomerReview.isPending || submitWorkerReview.isPending;

  const toggleCategory = (cat: string) => {
    setSelectedCategories((p) =>
      p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Please select a rating" });
      return;
    }
    if (!jobId) {
      toast({ title: "Invalid job reference" });
      return;
    }

    // Build comment — append selected category chips if present
    const fullComment = [
      ...selectedCategories,
      comment.trim(),
    ].filter(Boolean).join(" • ") || "";

    try {
      if (role === "worker") {
        // Worker rates the customer
        await submitWorkerReview.mutateAsync({
          jobId,
          rating,
          comment: fullComment,
        });
      } else {
        // Customer rates the worker
        await submitCustomerReview.mutateAsync({
          bookingId: jobId,
          rating,
          comment:   fullComment,
        });
      }

      toast({ title: "Rating submitted! ⭐", description: "Thanks for your feedback" });
      navigate(role === "worker" ? "/worker" : "/customer", { replace: true });

    } catch {
      // Error toast already shown by the mutation's onError handler
    }
  };

  return (
    <div className="app-shell min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="touch-target p-2 rounded-full hover:bg-muted transition-default"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-base font-bold text-foreground">Rate {ratingTarget}</h2>
      </header>

      <div className="flex-1 px-4 py-6 space-y-6">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-1">How was your experience?</h2>
          <p className="text-sm text-muted-foreground">Rate the {ratingTarget.toLowerCase()} for this job</p>
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setRating(s)}
              disabled={isLoading}
              className="touch-target p-1"
            >
              <Star
                className={`h-12 w-12 transition-all duration-200 ${
                  s <= rating
                    ? "fill-yellow-500 text-yellow-500 scale-110"
                    : "text-muted-foreground/30 hover:text-muted-foreground/50"
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm font-semibold text-foreground">
            {rating === 5 ? "Excellent!" : rating === 4 ? "Very Good!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
          </p>
        )}

        {/* Category Chips */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">What went well?</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                disabled={isLoading}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-default ${
                  selectedCategories.includes(cat)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground">Additional Comments (optional)</label>
          <Textarea
            placeholder="Share more details about your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            disabled={isLoading}
          />
        </div>

        {/* Submit */}
        <LoadingButton loading={isLoading} onClick={handleSubmit} disabled={rating === 0}>
          Submit Rating
        </LoadingButton>
      </div>
    </div>
  );
}