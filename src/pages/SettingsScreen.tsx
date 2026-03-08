import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import LanguageSelector from "@/components/LanguageSelector";
import { ConfirmDialog } from "@/components/shared";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

export default function SettingsScreen() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [clearing, setClearing] = useState(false);

  const [prefs, setPrefs] = useState({
    jobAlerts: true,
    paymentNotifs: true,
    demandAlerts: true,
    promoMessages: false,
    shareLocation: true,
    showInSearch: true,
  });

  const toggle = (key: keyof typeof prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleClearCache = async () => {
    setClearing(true);
    await new Promise((r) => setTimeout(r, 1200));
    setClearing(false);
    toast({ title: "Cache cleared", description: "All cached data has been removed." });
  };

  const handleDeleteAccount = () => {
    if (deleteStep === 0) { setDeleteStep(1); return; }
    logout();
    navigate("/login", { replace: true });
    toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
  };

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
      </header>

      <div className="px-4 py-5 space-y-6 pb-20">
        {/* Language */}
        <Section title="Language">
          <LanguageSelector className="w-full" />
        </Section>

        {/* Notifications */}
        <Section title="Notification Preferences">
          <ToggleRow label={role === "worker" ? "New job alerts" : "Booking updates"} checked={prefs.jobAlerts} onChange={() => toggle("jobAlerts")} />
          <ToggleRow label="Payment notifications" checked={prefs.paymentNotifs} onChange={() => toggle("paymentNotifs")} />
          {role === "worker" && <ToggleRow label="Demand prediction alerts" checked={prefs.demandAlerts} onChange={() => toggle("demandAlerts")} />}
          <ToggleRow label="Promotional messages" checked={prefs.promoMessages} onChange={() => toggle("promoMessages")} />
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <ToggleRow label="Share location while on job" checked={prefs.shareLocation} onChange={() => toggle("shareLocation")} />
          <ToggleRow label="Show profile in search" checked={prefs.showInSearch} onChange={() => toggle("showInSearch")} />
        </Section>

        {/* Data & Storage */}
        <Section title="Data & Storage">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Cache size</span>
            <span className="text-sm font-medium text-foreground">12.4 MB cached</span>
          </div>
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="touch-target w-full flex items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold text-foreground hover:bg-muted transition-default disabled:opacity-50"
          >
            {clearing ? <span className="animate-spin h-4 w-4 border-2 border-foreground border-t-transparent rounded-full" /> : <Trash2 className="h-4 w-4" />}
            Clear cached data
          </button>
        </Section>

        {/* Account */}
        <Section title="Account">
          <button onClick={() => setShowDeleteConfirm(true)} className="touch-target text-sm font-semibold text-destructive hover:underline">
            Delete Account
          </button>
        </Section>

        {/* Legal */}
        <Section title="Legal">
          <a href="#" target="_blank" rel="noopener" className="flex items-center justify-between py-2 text-sm text-foreground hover:text-primary transition-default">
            Terms of Service <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
          <a href="#" target="_blank" rel="noopener" className="flex items-center justify-between py-2 text-sm text-foreground hover:text-primary transition-default">
            Privacy Policy <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </Section>

        <p className="text-center text-xs text-muted-foreground">GigMatcher v1.0.0 (PWA)</p>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={deleteStep === 0 ? "Delete Account?" : "Are you absolutely sure?"}
        body={deleteStep === 0
          ? "This will permanently delete your account and all associated data. This action cannot be undone."
          : "All your data, bookings, and earnings history will be permanently lost. Type DELETE to confirm."
        }
        confirmLabel={deleteStep === 0 ? "Yes, Delete" : "Permanently Delete"}
        onConfirm={handleDeleteAccount}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteStep(0); }}
        destructive
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-3">{title}</h3>
      <div className="space-y-1 rounded-xl border border-border bg-card p-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="touch-target" />
    </div>
  );
}
