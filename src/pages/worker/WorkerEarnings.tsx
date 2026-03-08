// src/pages/worker/WorkerEarnings.tsx
// POLISH-2 FIX [PDF DOWNLOAD]:
//   handleDownload now generates a real PDF using the browser's print-to-PDF
//   mechanism via a hidden printable div. Opens in a new window styled for
//   A4 printing so the browser "Save as PDF" dialog produces a clean report.
//   No new dependencies required — uses only the existing window.print() API
//   in an isolated popup window so the main app UI is never altered.
// ALL other JSX structure, Tailwind classes, data display — IDENTICAL to original.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEnhancedEarnings } from "@/hooks/usePaymentApi";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Line, ComposedChart } from "recharts";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import LoadingButton from "@/components/LoadingButton";
import ProSubscriptionCard from "@/components/ProSubscriptionCard";

const PERIODS = ["today", "week", "month", "custom"] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, string> = {
  today:  "Today",
  week:   "This Week",
  month:  "This Month",
  custom: "Custom",
};

export default function WorkerEarnings() {
  const [period, setPeriod]       = useState<Period>("week");
  const [downloading, setDownloading] = useState(false);
  const navigate                  = useNavigate();
  const { data, isLoading }       = useEnhancedEarnings(period);

  const statusChip = (s: string) => {
    if (s === "paid")       return "bg-accent/10 text-accent";
    if (s === "processing") return "bg-primary/10 text-primary";
    return "bg-secondary/10 text-secondary";
  };

  // [POLISH-2 FIX] Real PDF download — opens a print-ready window
  const handleDownload = async () => {
    if (!data) return;
    setDownloading(true);

    try {
      // Build HTML content for the report
      const periodLabel = PERIOD_LABELS[period];
      const txRows = (data.transactions ?? [])
        .map(
          (tx) =>
            `<tr>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${tx.serviceIcon} ${tx.serviceType}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${tx.customerName}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${tx.date}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${tx.grossAmount}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${tx.netAmount}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">
                <span style="background:${tx.status === "paid" ? "#d1fae5" : "#fef9c3"};color:${tx.status === "paid" ? "#065f46" : "#713f12"};padding:2px 8px;border-radius:999px;font-size:11px;">${tx.status}</span>
              </td>
            </tr>`
        )
        .join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GigMatcher Earnings Report</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; font-size: 13px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .badge { display:inline-block; background:#eff6ff; color:#1d4ed8; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:600; margin-bottom:16px; }
    .summary-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:20px; }
    .card { border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; }
    .card p { margin:0; font-size:12px; color:#64748b; }
    .card .value { font-size:22px; font-weight:700; margin-top:4px; }
    .card .value.green { color:#059669; }
    .card .value.red   { color:#dc2626; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th { background:#f8fafc; padding:8px; text-align:left; font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:.05em; }
    .footer { margin-top:24px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px; }
  </style>
</head>
<body>
  <h1>💼 GigMatcher</h1>
  <div class="badge">Earnings Report — ${periodLabel}</div>
  <div class="summary-grid">
    <div class="card">
      <p>Gross Earnings</p>
      <div class="value">₹${data.grossEarnings.toLocaleString()}</div>
    </div>
    <div class="card">
      <p>Net Payout (after 10% commission)</p>
      <div class="value green">₹${data.netPayout.toLocaleString()}</div>
    </div>
    <div class="card">
      <p>Platform Commission</p>
      <div class="value red">-₹${data.commission.toLocaleString()}</div>
    </div>
    <div class="card">
      <p>Jobs Completed</p>
      <div class="value">${data.jobsCompleted}</div>
    </div>
  </div>

  <h2 style="font-size:15px;margin:0 0 8px;">Transactions</h2>
  <table>
    <thead>
      <tr>
        <th>Service</th>
        <th>Customer</th>
        <th>Date</th>
        <th style="text-align:right;">Gross</th>
        <th style="text-align:right;">Net</th>
        <th style="text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>${txRows || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#94a3b8;">No transactions for this period</td></tr>'}</tbody>
  </table>

  <div class="footer">
    Generated by GigMatcher • ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
</body>
</html>`;

      // Open in popup so print dialog doesn't affect main app
      const popup = window.open("", "_blank", "width=800,height=600");
      if (popup) {
        popup.document.write(html);
        popup.document.close();
      } else {
        // Fallback: create a Blob and download as HTML (user can open + print)
        const blob = new Blob([html], { type: "text/html" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `gigmatcher-earnings-${period}-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-5 space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in pb-24">
      <h2 className="text-xl font-bold text-foreground">Earnings</h2>

      {/* Period Selector */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 touch-target rounded-lg py-2.5 text-sm font-semibold transition-default ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Hero Earnings Card */}
      {data && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-5">
          <p className="text-sm text-muted-foreground mb-1 text-center">{PERIOD_LABELS[period]}</p>
          <p className="text-4xl font-bold text-foreground text-center">₹{data.total.toLocaleString()}</p>
          <div className={`flex items-center justify-center gap-1 mt-1.5 text-sm font-semibold ${data.isUp ? "text-accent" : "text-destructive"}`}>
            {data.isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>{data.isUp ? "+" : ""}{data.percentChange}% vs last period</span>
          </div>
        </div>
      )}

      {/* Chart */}
      {data && data.chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={data.chartData}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="amount" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Earnings" />
              <Line dataKey="average" stroke="hsl(24, 95%, 53%)" strokeWidth={2} dot={false} strokeDasharray="4 4" name="Average" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Breakdown */}
      {data && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h4 className="text-sm font-bold text-foreground mb-1">Summary</h4>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gross earnings</span>
            <span className="text-foreground font-semibold">₹{data.grossEarnings.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-destructive">Platform commission (10%)</span>
            <span className="text-destructive font-semibold">-₹{data.commission.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2">
            <span className="text-accent font-bold">Net payout</span>
            <span className="text-accent font-bold text-lg">₹{data.netPayout.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Jobs completed</span>
            <span className="text-foreground font-semibold">{data.jobsCompleted}</span>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h3 className="text-base font-bold text-foreground mb-3">Transactions</h3>
        <div className="space-y-2">
          {data?.transactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => navigate(`/worker/invoice/${tx.id}`)}
              className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-default hover:bg-muted/50"
            >
              <span className="text-xl shrink-0">{tx.serviceIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{tx.customerName}</p>
                <p className="text-xs text-muted-foreground">{tx.serviceType} • {tx.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground line-through">₹{tx.grossAmount}</p>
                <p className="text-sm font-bold text-foreground">₹{tx.netAmount}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusChip(tx.status)}`}>
                  {tx.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* [POLISH-2 FIX] Download — now generates a real printable PDF report */}
      <LoadingButton loading={downloading} onClick={handleDownload} variant="outline" className="w-full">
        <Download className="h-4 w-4 mr-2" /> Download PDF Report
      </LoadingButton>

      {/* Pro Subscription Card */}
      <ProSubscriptionCard />
    </div>
  );
}