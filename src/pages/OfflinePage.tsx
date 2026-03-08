import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { EmptyState } from "@/components/shared";
import LoadingButton from "@/components/LoadingButton";
import { CloudOff, Eye, DollarSign, User, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const OFFLINE_FEATURES = [
  { icon: Eye, label: "View past jobs and bookings" },
  { icon: DollarSign, label: "View earnings history" },
  { icon: User, label: "View your profile" },
];

export default function OfflinePage() {
  const { isOnline } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOnline) navigate(-1);
  }, [isOnline, navigate]);

  const handleRetry = () => {
    if (navigator.onLine) {
      navigate(-1);
    } else {
      toast({ title: "Still offline", description: "Please check your internet connection.", variant: "destructive" });
    }
  };

  return (
    <div className="app-shell min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* SVG Cloud with X */}
      <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="mb-6 text-muted-foreground/40">
        <path
          d="M95 55a25 25 0 00-24-30 30 30 0 00-56 10A20 20 0 0020 75h70a25 25 0 005-20z"
          fill="currentColor"
          opacity="0.3"
        />
        <line x1="45" y1="40" x2="75" y2="65" stroke="hsl(var(--destructive))" strokeWidth="4" strokeLinecap="round" />
        <line x1="75" y1="40" x2="45" y2="65" stroke="hsl(var(--destructive))" strokeWidth="4" strokeLinecap="round" />
      </svg>

      <h1 className="text-xl font-bold text-foreground mb-2">No Internet Connection</h1>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        Some features are unavailable. Cached data shown where possible.
      </p>

      <div className="w-full max-w-xs space-y-3 mb-8">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Offline</p>
        {OFFLINE_FEATURES.map((f, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <CheckCircle className="h-5 w-5 text-accent shrink-0" />
            <span className="text-sm text-foreground">{f.label}</span>
          </div>
        ))}
      </div>

      <LoadingButton onClick={handleRetry}>Retry Connection</LoadingButton>
    </div>
  );
}
