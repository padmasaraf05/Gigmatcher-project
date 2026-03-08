import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import LanguageSelector from "@/components/LanguageSelector";
import LoadingButton from "@/components/LoadingButton";
import { Phone, Briefcase } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOTP = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
    setLoading(false);
    if (error) {
      toast({ title: "Could not send OTP", description: error.message });
      return;
    }
    navigate("/verify-otp", { state: { phone } });
  };

  return (
    <div className="app-shell flex flex-col px-6 py-12">
      <div className="animate-fade-in-up flex flex-col items-center mb-10">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Briefcase className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="text-muted-foreground mt-1">Login to your GigMatcher account</p>
      </div>

      <div className="animate-fade-in-up space-y-5" style={{ animationDelay: "150ms" }}>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Phone Number</label>
          <div className="flex items-center gap-2">
            <span className="flex h-12 items-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
              +91
            </span>
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 10-digit number"
                disabled={loading}
                className="touch-target w-full rounded-lg border border-border bg-card pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <LoadingButton loading={loading} onClick={handleSendOTP} disabled={phone.length < 10}>
          Send OTP
        </LoadingButton>
      </div>

      <div className="mt-auto pt-10 flex flex-col items-center gap-3 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <LanguageSelector />
        <Link to="/register" className="text-sm font-medium text-primary underline underline-offset-4 touch-target">
          New user? Register
        </Link>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <button className="underline touch-target">Terms of Service</button>
          <span>·</span>
          <button className="underline touch-target">Privacy Policy</button>
        </div>
      </div>
    </div>
  );
}
