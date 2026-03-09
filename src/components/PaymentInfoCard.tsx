// src/components/PaymentInfoCard.tsx
// BUG FIX [ISSUE 4] — Platform fee was being charged to customer:
//   OLD: platformFee = 20  (default) → customer total = serviceCharge + 20
//   FIX: platformFee = 0   (default) → customer pays face value only
//
//   Design decision: "Worker pays commission only (customer pays face value)"
//   Worker's 10% commission is deducted from their earnings (WorkerEarnings).
//   Customer is never charged a platform fee.
//
//   The platformFee prop is kept for API compatibility (e.g. if a specific
//   booking explicitly passes a non-zero fee in future). Existing callers
//   that don't pass the prop will now correctly default to ₹0.
//
//   Also hides the "Platform fee" row when fee is ₹0 to keep UI clean.
//
//   All other JSX, sheet logic, method selector — IDENTICAL to previous version.

import { useState } from "react";
import { useProcessPayment, usePaymentMethods } from "@/hooks/usePaymentApi";
import LoadingButton from "@/components/LoadingButton";
import { CreditCard, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PaymentInfoCardProps {
  bookingId: string;
  serviceCharge: number;
  platformFee?: number;   // [FIX 4] defaults to 0 — customer pays face value only
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "refunded" | "failed";
}

const DEFAULT_METHODS = [
  { id: "upi",  label: "UPI",        identifier: "Pay via UPI app" },
  { id: "card", label: "Debit Card", identifier: "Pay via card"    },
];

export default function PaymentInfoCard({
  bookingId,
  serviceCharge,
  platformFee = 0,          // [FIX 4] was 20 — now 0 so customer pays face value
  paymentMethod,
  paymentStatus,
}: PaymentInfoCardProps) {
  const [showPaySheet, setShowPaySheet]           = useState(false);
  const [selectedMethodId, setSelectedMethodId]   = useState<string>("");
  const processPayment = useProcessPayment();
  const { data: savedMethods }                    = usePaymentMethods();

  // [FIX 4] total = serviceCharge only (platformFee is 0 for customer)
  const total = serviceCharge + platformFee;

  const methods = savedMethods && savedMethods.length > 0
    ? savedMethods.map((m) => ({ id: m.id, label: m.label, identifier: m.identifier }))
    : DEFAULT_METHODS;

  const handleOpenSheet = () => {
    const defaultId = savedMethods?.find((m) => m.isDefault)?.id
      ?? methods[0]?.id
      ?? "";
    setSelectedMethodId(defaultId);
    setShowPaySheet(true);
  };

  const statusStyles: Record<string, string> = {
    pending:  "bg-yellow-500/10 text-yellow-600",
    paid:     "bg-accent/10 text-accent",
    failed:   "bg-destructive/10 text-destructive",
    refunded: "bg-muted text-muted-foreground",
  };

  const handlePay = async () => {
    const selected    = methods.find((m) => m.id === selectedMethodId);
    const methodLabel = selected?.label ?? "UPI";

    await processPayment.mutateAsync({ bookingId, method: methodLabel });
    setShowPaySheet(false);
    toast({ title: "Payment successful! ✓", description: `₹${total} paid via ${methodLabel}` });
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Payment</h4>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service charge</span>
            <span className="text-foreground">₹{serviceCharge}</span>
          </div>
          {/* [FIX 4] Only show platform fee row when it's actually non-zero */}
          {platformFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform fee</span>
              <span className="text-foreground">₹{platformFee}</span>
            </div>
          )}
          <div className="border-t border-border pt-1.5 flex justify-between">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">₹{total}</span>
          </div>
        </div>

        {/* Method + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{paymentMethod}</span>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[paymentStatus] || statusStyles.pending}`}>
            {paymentStatus}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {paymentStatus === "pending" && (
            <LoadingButton
              loading={false}
              onClick={handleOpenSheet}
              className="flex-1"
            >
              Pay Now
            </LoadingButton>
          )}
          <button
            onClick={() => toast({ title: "Receipt ready", description: "PDF receipt saved" })}
            className="touch-target flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold text-foreground transition-default hover:bg-muted"
          >
            <FileText className="h-3.5 w-3.5" /> Receipt
          </button>
        </div>
      </div>

      {/* Payment Bottom Sheet — unchanged */}
      {showPaySheet && (
        <>
          <div
            className="fixed inset-0 z-[9999] bg-foreground/30 animate-fade-in"
            onClick={() => setShowPaySheet(false)}
          />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border p-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-foreground mb-1">Confirm Payment</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Pay <span className="font-bold text-foreground">₹{total}</span>
            </p>

            {/* Payment method selector */}
            <div className="space-y-2 mb-4">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethodId(m.id)}
                  className={`w-full touch-target flex items-center gap-3 rounded-xl border px-4 py-3 transition-default ${
                    selectedMethodId === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedMethodId === m.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  }`}>
                    {selectedMethodId === m.id && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.identifier}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaySheet(false)}
                className="flex-1 touch-target rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-default hover:bg-muted"
              >
                Cancel
              </button>
              <LoadingButton
                loading={processPayment.isPending}
                onClick={handlePay}
                className="flex-1"
              >
                Pay ₹{total}
              </LoadingButton>
            </div>
          </div>
        </>
      )}
    </>
  );
}