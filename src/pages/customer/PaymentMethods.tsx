import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaymentMethods, useAddPaymentMethod, useDeletePaymentMethod, useSetDefaultPaymentMethod } from "@/hooks/usePaymentApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import LoadingButton from "@/components/LoadingButton";
import { ChevronLeft, CreditCard, Trash2, Check, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function PaymentMethods() {
  const navigate = useNavigate();
  const { data: methods, isLoading } = usePaymentMethods();
  const addMethod = useAddPaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  const setDefault = useSetDefaultPaymentMethod();

  const [showAddUpi, setShowAddUpi] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleAddUpi = async () => {
    if (!upiId.includes("@")) { toast({ title: "Enter a valid UPI ID" }); return; }
    await addMethod.mutateAsync({ type: "upi", identifier: upiId });
    toast({ title: "UPI added ✓" });
    setUpiId("");
    setShowAddUpi(false);
  };

  const handleAddCard = async () => {
    if (cardNumber.replace(/\s/g, "").length < 16) { toast({ title: "Enter valid card number" }); return; }
    const masked = `****${cardNumber.replace(/\s/g, "").slice(-4)}`;
    await addMethod.mutateAsync({ type: "card", identifier: masked });
    toast({ title: "Card added ✓" });
    setCardNumber(""); setCardExpiry(""); setCardCvv("");
    setShowAddCard(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMethod.mutateAsync(deleteTarget);
    toast({ title: "Payment method removed" });
    setDeleteTarget(null);
  };

  const formatCard = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-40" />
        {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in pb-24">
      <button onClick={() => navigate(-1)} className="touch-target flex items-center gap-1 text-sm font-semibold text-primary">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <h2 className="text-xl font-bold text-foreground">Payment Methods</h2>

      {/* Saved Methods */}
      <div className="space-y-2">
        {methods?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <button
              onClick={() => setDefault.mutateAsync(m.id).then(() => toast({ title: "Default updated" }))}
              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                m.isDefault ? "border-primary bg-primary" : "border-muted-foreground"
              }`}
            >
              {m.isDefault && <Check className="h-3 w-3 text-primary-foreground" />}
            </button>
            <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.identifier}</p>
            </div>
            <button onClick={() => setDeleteTarget(m.id)} className="touch-target p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-default">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowAddUpi(true); setShowAddCard(false); }}
          className="flex-1 touch-target flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 py-3 text-sm font-semibold text-primary transition-default hover:border-primary/60"
        >
          <Plus className="h-4 w-4" /> Add UPI
        </button>
        <button
          onClick={() => { setShowAddCard(true); setShowAddUpi(false); }}
          className="flex-1 touch-target flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/30 py-3 text-sm font-semibold text-primary transition-default hover:border-primary/60"
        >
          <Plus className="h-4 w-4" /> Add Card
        </button>
      </div>

      {/* Add UPI Form */}
      {showAddUpi && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-fade-in">
          <h4 className="text-sm font-bold text-foreground">Add UPI ID</h4>
          <Input placeholder="yourname@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setShowAddUpi(false)} className="flex-1 touch-target rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground">Cancel</button>
            <LoadingButton loading={addMethod.isPending} onClick={handleAddUpi} className="flex-1">Verify & Add</LoadingButton>
          </div>
        </div>
      )}

      {/* Add Card Form */}
      {showAddCard && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-fade-in">
          <h4 className="text-sm font-bold text-foreground">Add Card</h4>
          <Input placeholder="Card number" value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} />
          <div className="flex gap-2">
            <Input placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} />
            <Input placeholder="CVV" type="password" maxLength={3} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAddCard(false)} className="flex-1 touch-target rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground">Cancel</button>
            <LoadingButton loading={addMethod.isPending} onClick={handleAddCard} className="flex-1">Add Card</LoadingButton>
          </div>
        </div>
      )}

      {/* Delete Confirmation Bottom Sheet */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-foreground/30 animate-fade-in" onClick={() => setDeleteTarget(null)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border p-5 animate-slide-up">
            <h3 className="text-base font-bold text-foreground mb-2">Remove Payment Method?</h3>
            <p className="text-sm text-muted-foreground mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 touch-target rounded-lg border border-border py-3 text-sm font-semibold text-foreground">Keep</button>
              <LoadingButton variant="primary" className="flex-1 !bg-destructive" loading={deleteMethod.isPending} onClick={handleDelete}>Remove</LoadingButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
