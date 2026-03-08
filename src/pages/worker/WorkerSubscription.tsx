import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useSubscriptionStatus, useUpgradeSubscription, useCancelSubscription,
  PLAN_COMPARISON, PRO_BENEFITS,
} from "@/hooks/usePaymentApi";
import { Skeleton } from "@/components/ui/skeleton";
import LoadingButton from "@/components/LoadingButton";
import { ChevronLeft, Crown, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function WorkerSubscription() {
  const navigate = useNavigate();
  const { data: sub, isLoading } = useSubscriptionStatus();
  const upgrade = useUpgradeSubscription();
  const cancel = useCancelSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("UPI");

  const isPro = sub?.plan === "pro";

  const handleUpgrade = async () => {
    await upgrade.mutateAsync(selectedMethod);
    setShowUpgrade(false);
    toast({ title: "Welcome to Pro! 🎉", description: "You now have access to all premium features" });
  };

  const handleCancel = async () => {
    await cancel.mutateAsync();
    toast({ title: "Subscription cancelled", description: "You'll retain Pro features until the end of the billing period" });
  };

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in pb-24">
      <button onClick={() => navigate(-1)} className="touch-target flex items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <h2 className="text-xl font-bold text-foreground">Subscription</h2>

      {/* Current Plan */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${isPro ? "bg-secondary/10 border border-secondary/30" : "bg-muted border border-border"}`}>
        <Crown className={`h-8 w-8 shrink-0 ${isPro ? "text-secondary" : "text-muted-foreground"}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-foreground">{isPro ? "Pro Plan" : "Free Plan"}</p>
            {isPro && <span className="rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] font-bold">ACTIVE</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {isPro ? `Next renewal: ${sub.renewalDate || "Mar 15, 2026"}` : "Limited features"}
          </p>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-3 border-b border-border">
          <div className="p-3 text-xs font-bold text-muted-foreground">Feature</div>
          <div className="p-3 text-xs font-bold text-center text-muted-foreground">Free</div>
          <div className="p-3 text-xs font-bold text-center text-secondary">Pro</div>
        </div>
        {PLAN_COMPARISON.map((row, i) => (
          <div key={i} className={`grid grid-cols-3 ${i < PLAN_COMPARISON.length - 1 ? "border-b border-border" : ""}`}>
            <div className="p-3 text-xs text-foreground">{row.feature}</div>
            <div className="p-3 flex justify-center items-center">
              {typeof row.free === "boolean" ? (
                row.free ? <Check className="h-4 w-4 text-accent" /> : <X className="h-4 w-4 text-muted-foreground/30" />
              ) : (
                <span className="text-xs text-muted-foreground">{row.free}</span>
              )}
            </div>
            <div className="p-3 flex justify-center items-center">
              {typeof row.pro === "boolean" ? (
                row.pro ? <Check className="h-4 w-4 text-accent" /> : <X className="h-4 w-4 text-muted-foreground/30" />
              ) : (
                <span className="text-xs font-semibold text-secondary">{row.pro}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      {!isPro ? (
        <button
          onClick={() => setShowUpgrade(true)}
          className="touch-target w-full rounded-lg bg-secondary py-3.5 text-sm font-bold text-secondary-foreground transition-default hover:bg-secondary/90"
        >
          Upgrade to Pro — ₹99/month
        </button>
      ) : (
        <button
          onClick={handleCancel}
          className="text-xs font-semibold text-destructive"
        >
          Cancel subscription
        </button>
      )}

      {/* Payment History */}
      {sub && sub.paymentHistory.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-foreground mb-3">Payment History</h3>
          <div className="space-y-2">
            {sub.paymentHistory.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Pro Subscription</p>
                  <p className="text-xs text-muted-foreground">{p.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">₹{p.amount}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    p.status === "paid" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                  }`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade Bottom Sheet */}
      {showUpgrade && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/30 animate-fade-in" onClick={() => setShowUpgrade(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border p-5 animate-slide-up">
            <h3 className="text-base font-bold text-foreground mb-3">Choose Payment Method</h3>
            <div className="space-y-2 mb-4">
              {["UPI", "Debit Card"].map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`w-full touch-target flex items-center gap-3 rounded-xl border px-4 py-3 transition-default ${
                    selectedMethod === m ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === m ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}>
                    {selectedMethod === m && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{m}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowUpgrade(false)} className="flex-1 touch-target rounded-lg border border-border py-3 text-sm font-semibold text-foreground">Cancel</button>
              <LoadingButton loading={upgrade.isPending} onClick={handleUpgrade} className="flex-1 !bg-secondary">
                Pay ₹99
              </LoadingButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
