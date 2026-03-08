import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEnhancedEarnings } from "@/hooks/usePaymentApi";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Line, ComposedChart } from "recharts";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import LoadingButton from "@/components/LoadingButton";
import ProSubscriptionCard from "@/components/ProSubscriptionCard";

const PERIODS = ["today", "week", "month", "custom"] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  custom: "Custom",
};

export default function WorkerEarnings() {
  const [period, setPeriod] = useState<Period>("week");
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();
  const { data, isLoading } = useEnhancedEarnings(period);

  const statusChip = (s: string) => {
    if (s === "paid") return "bg-accent/10 text-accent";
    if (s === "processing") return "bg-primary/10 text-primary";
    return "bg-secondary/10 text-secondary";
  };

  const handleDownload = async () => {
    setDownloading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setDownloading(false);
    toast({ title: "Report ready! 📄", description: "PDF report saved to your device" });
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

      {/* Download */}
      <LoadingButton loading={downloading} onClick={handleDownload} variant="outline" className="w-full">
        <Download className="h-4 w-4 mr-2" /> Download PDF Report
      </LoadingButton>

      {/* Pro Subscription Card */}
      <ProSubscriptionCard />
    </div>
  );
}
