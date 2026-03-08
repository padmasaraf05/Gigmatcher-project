// src/components/PaymentInfoCard.tsx
// PHASE 12b FIX:
//   [FIX 1] Payment bottom sheet now loads saved payment methods from DB
//           via usePaymentMethods() and lets user select before paying.
//   [FIX 2] handlePay() calls real Razorpay via useProcessPayment()
//           with the user-selected method — no longer passes the prop string.
//   [FIX 3] If no saved methods exist, falls back to UPI + Debit Card options
//           so the sheet is never empty.
//   ALL JSX structure, Tailwind classes, layout — IDENTICAL to original.

import { useState } from "react";
import { useProcessPayment, usePaymentMethods } from "@/hooks/usePaymentApi";
import LoadingButton from "@/components/LoadingButton";
import { CreditCard, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PaymentInfoCardProps {
  bookingId: string;
  serviceCharge: number;
  platformFee?: number;
  paymentMethod: string;
  paymentStatus: "pending" | "paid" | "refunded" | "failed";
}

// Default methods shown when DB has no saved methods yet
const DEFAULT_METHODS = [
  { id: "upi",  label: "UPI",        identifier: "Pay via UPI app" },
  { id: "card", label: "Debit Card", identifier: "Pay via card"    },
];

export default function PaymentInfoCard({
  bookingId,
  serviceCharge,
  platformFee = 20,
  paymentMethod,
  paymentStatus,
}: PaymentInfoCardProps) {
  const [showPaySheet, setShowPaySheet]       = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const processPayment = useProcessPayment();
  const { data: savedMethods }                = usePaymentMethods();
  const total = serviceCharge + platformFee;

  // Merge saved methods with defaults — use saved if available, else defaults
  const methods = savedMethods && savedMethods.length > 0
    ? savedMethods.map((m) => ({ id: m.id, label: m.label, identifier: m.identifier }))
    : DEFAULT_METHODS;

  // Auto-select default method when sheet opens
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

  // [FIX 2] Pass selected method label to Razorpay
  const handlePay = async () => {
    const selected = methods.find((m) => m.id === selectedMethodId);
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
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform fee</span>
            <span className="text-foreground">₹{platformFee}</span>
          </div>
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

      {/* Payment Bottom Sheet — [FIX 1] method selector added inside */}
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

            {/* [FIX 1] Payment method selector */}
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