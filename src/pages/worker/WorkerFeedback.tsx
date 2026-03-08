import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import StarRating from "@/components/shared/StarRating";
import LoadingButton from "@/components/LoadingButton";

const CATEGORIES = ["Bug Report", "Feature Request", "General Feedback", "Other"];

export default function WorkerFeedback() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});

  const handleSubmit = async () => {
    const e: typeof errors = {};
    if (!rating) e.rating = "Please select a rating";
    if (!comment.trim()) e.comment = "Please tell us more";
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">Send Feedback</h1>
        </header>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-accent" />
          <h2 className="text-xl font-bold text-foreground">Thank you for your feedback!</h2>
          <p className="text-sm text-muted-foreground">Your response helps us improve GigMatcher.</p>
          <button onClick={() => navigate("/worker")} className="touch-target mt-4 w-full rounded-lg bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-default hover:opacity-90">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Send Feedback</h1>
      </header>

      <div className="px-4 py-5 space-y-6 pb-28">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">How would you rate your experience?</label>
          <StarRating rating={rating} interactive onRate={setRating} size={48} />
          {errors.rating && <p className="text-xs text-destructive">{errors.rating}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`touch-target rounded-full px-4 py-2 text-xs font-semibold transition-default ${
                  category === c ? "border-2 border-primary bg-primary/10 text-primary" : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Tell us more...</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more..."
            className="touch-target w-full rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] resize-none"
          />
          {errors.comment && <p className="text-xs text-destructive">{errors.comment}</p>}
        </div>

        <LoadingButton loading={submitting} onClick={handleSubmit}>Submit Feedback</LoadingButton>
      </div>
    </div>
  );
}
