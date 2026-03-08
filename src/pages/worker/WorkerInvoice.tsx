// src/pages/worker/WorkerInvoice.tsx
// POLISH [ISSUE 6]:
//   Download PDF button now calls window.print() which triggers the browser's
//   native print-to-PDF dialog. The page already has print:hidden classes on
//   all non-invoice elements, so the printed output is a clean invoice.
//   Share button copies a direct link to clipboard as fallback.
// ALL JSX layout, Tailwind classes, data display — IDENTICAL to original.

import { useParams, useNavigate } from "react-router-dom";
import { useInvoice } from "@/hooks/usePaymentApi";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Download, Share2, Briefcase } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function WorkerInvoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id || "");

  if (isLoading) {
    return (
      <div className="app-shell min-h-screen bg-card px-4 py-5 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="app-shell min-h-screen bg-card px-4 py-10 text-center text-muted-foreground">
        Invoice not found
      </div>
    );
  }

  // [POLISH 6] Trigger browser print-to-PDF dialog
  const handleDownloadPdf = () => {
    // Small delay so any open menus/toasts dismiss first
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: `Invoice ${invoice.invoiceNumber}`,
      text:  `GigMatcher invoice for ₹${invoice.grossAmount}`,
      url:   shareUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled — do nothing
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Link copied!", description: "Invoice link copied to clipboard" });
      } catch {
        toast({ title: "Share unavailable", description: "Please copy the URL manually" });
      }
    }
  };

  return (
    <div className="app-shell min-h-screen bg-card">
      {/* Print styles injected inline so no separate CSS file is needed */}
      <style>{`
        @media print {
          @page { margin: 16mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="px-5 py-5 space-y-5 animate-fade-in">
        <button
          onClick={() => navigate(-1)}
          className="touch-target flex items-center gap-1 text-sm font-semibold text-primary print:hidden"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {/* Logo Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground">
              Gig<span className="text-primary">Matcher</span>
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground">{invoice.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">{invoice.date}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Worker</p>
            <p className="text-sm font-semibold text-foreground">{invoice.workerName}</p>
            <p className="text-xs text-muted-foreground">{invoice.workerPhone}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Customer</p>
            <p className="text-sm font-semibold text-foreground">{invoice.customerName}</p>
            <p className="text-xs text-muted-foreground">{invoice.customerPhone}</p>
          </div>
        </div>

        {/* Service Line Item */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-4 bg-muted px-3 py-2">
            <div className="col-span-2 text-[10px] uppercase font-bold text-muted-foreground">Description</div>
            <div className="text-[10px] uppercase font-bold text-muted-foreground text-right">Hrs × Rate</div>
            <div className="text-[10px] uppercase font-bold text-muted-foreground text-right">Subtotal</div>
          </div>
          <div className="grid grid-cols-4 px-3 py-3">
            <div className="col-span-2 text-sm text-foreground">{invoice.serviceDescription}</div>
            <div className="text-sm text-muted-foreground text-right">{invoice.hours} × ₹{invoice.rate}</div>
            <div className="text-sm font-semibold text-foreground text-right">₹{invoice.subtotal}</div>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gross amount</span>
            <span className="text-foreground">₹{invoice.grossAmount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-destructive">Platform commission (10%)</span>
            <span className="text-destructive">-₹{invoice.commission}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2">
            <span className="font-bold text-accent">Net payout</span>
            <span className="font-bold text-accent text-lg">₹{invoice.netAmount}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="rounded-xl bg-muted p-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Payment method</span>
            <span className="text-foreground font-medium">{invoice.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Transaction ID</span>
            <span className="text-foreground font-mono font-medium">{invoice.transactionId}</span>
          </div>
        </div>

        {/* Total */}
        <div className="text-center py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold text-foreground">₹{invoice.grossAmount}</p>
        </div>

        {/* [POLISH 6] Actions — Download PDF now calls window.print() */}
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handleDownloadPdf}
            className="flex-1 touch-target flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-default hover:bg-primary/90"
          >
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button
            onClick={handleShare}
            className="touch-target flex items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-semibold text-foreground transition-default hover:bg-muted"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}