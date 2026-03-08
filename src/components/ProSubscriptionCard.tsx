import { Crown, Check } from "lucide-react";
import { useSubscriptionStatus, PRO_BENEFITS } from "@/hooks/usePaymentApi";
import { useNavigate } from "react-router-dom";

export default function ProSubscriptionCard() {
  const { data: sub } = useSubscriptionStatus();
  const navigate = useNavigate();
  const isPro = sub?.plan === "pro";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className={`p-4 flex items-center gap-3 ${isPro ? "bg-secondary/10" : "bg-gradient-to-r from-primary to-primary/80"}`}>
        <Crown className={`h-7 w-7 shrink-0 ${isPro ? "text-secondary" : "text-primary-foreground"}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold ${isPro ? "text-foreground" : "text-primary-foreground"}`}>
              {isPro ? "Pro Plan Active" : "Upgrade to Pro"}
            </p>
            {isPro && (
              <span className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] font-bold">PRO ✓</span>
            )}
          </div>
          <p className={`text-xs ${isPro ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
            {isPro ? `Renews ${sub.renewalDate || "next month"}` : "₹99/month for premium features"}
          </p>
        </div>
      </div>

      {/* Benefits (compact) */}
      {!isPro && (
        <div className="px-4 py-3 space-y-1.5">
          {PRO_BENEFITS.slice(0, 3).map((b) => (
            <div key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-accent shrink-0" />
              <span>{b}</span>
            </div>
          ))}
          <button
            onClick={() => navigate("/worker/subscription")}
            className="touch-target w-full mt-2 rounded-lg bg-secondary py-3 text-sm font-bold text-secondary-foreground transition-default hover:bg-secondary/90"
          >
            Upgrade — ₹99/month
          </button>
        </div>
      )}

      {isPro && (
        <div className="px-4 py-3">
          <button
            onClick={() => navigate("/worker/subscription")}
            className="text-xs font-semibold text-primary"
          >
            Manage subscription →
          </button>
        </div>
      )}
    </div>
  );
}
