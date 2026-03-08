import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import LoadingButton from "@/components/LoadingButton";
import { toast } from "@/hooks/use-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT_SCHEDULE = DAYS.map((d) => ({
  day: d,
  enabled: ["Monday", "Wednesday", "Friday"].includes(d),
  from: "09:00",
  to: "18:00",
}));

export default function WorkerAvailabilitySettings() {
  const navigate = useNavigate();
  const [available, setAvailable] = useState(true);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);

  const toggle = (i: number) => setSchedule((s) => s.map((r, idx) => (idx === i ? { ...r, enabled: !r.enabled } : r)));
  const setTime = (i: number, field: "from" | "to", val: string) =>
    setSchedule((s) => s.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast({ title: "Schedule saved! ✓" });
  };

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Availability Settings</h1>
      </header>

      <div className="px-4 py-5 space-y-6 pb-28">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <span className="text-sm font-semibold text-foreground">Currently Available</span>
          <Switch checked={available} onCheckedChange={setAvailable} />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Weekly Schedule</h3>
          {schedule.map((row, i) => (
            <div key={row.day} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{row.day}</span>
                <Switch checked={row.enabled} onCheckedChange={() => toggle(i)} />
              </div>
              {row.enabled && (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">From</label>
                    <input type="time" value={row.from} onChange={(e) => setTime(i, "from", e.target.value)}
                      className="touch-target w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">To</label>
                    <input type="time" value={row.to} onChange={(e) => setTime(i, "to", e.target.value)}
                      className="touch-target w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <LoadingButton loading={saving} onClick={handleSave}>Save Schedule</LoadingButton>
      </div>
    </div>
  );
}
