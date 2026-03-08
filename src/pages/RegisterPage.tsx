import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import LanguageSelector from "@/components/LanguageSelector";
import LoadingButton from "@/components/LoadingButton";
import { UserRole } from "@/lib/types";
import { Phone, User, Wrench, Briefcase, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const defaultRole = (searchParams.get("role") as UserRole) || "customer";
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register, language } = useAuth();

  const handleRegister = async () => {
    if (!name || phone.length < 10 || !agreed) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
      options: {
        data: {
          name,
          role,
          language,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Could not send OTP", description: error.message });
      return;
    }
    navigate("/verify-otp", { state: { phone, fromRegister: true, registerData: { name, phone, role, language } } });
  };

  return (
    <div className="app-shell flex flex-col px-6 py-8">
      <div className="animate-fade-in-up mb-8">
        <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
        <p className="text-muted-foreground mt-1">Join GigMatcher today</p>
      </div>

      <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        {/* Role Selection Cards */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">I am a…</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("worker")}
              className={`relative rounded-xl border-2 p-4 transition-default active:scale-[0.97] ${
                role === "worker"
                  ? "border-secondary bg-secondary/10"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              {role === "worker" && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-secondary">
                  <Check className="h-3 w-3 text-secondary-foreground" />
                </div>
              )}
              <Wrench className={`h-8 w-8 mb-2 ${role === "worker" ? "text-secondary" : "text-muted-foreground"}`} />
              <p className="font-semibold text-foreground">Worker</p>
              <p className="text-xs text-muted-foreground mt-0.5">Find gigs & earn</p>
            </button>

            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`relative rounded-xl border-2 p-4 transition-default active:scale-[0.97] ${
                role === "customer"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              {role === "customer" && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <Briefcase className={`h-8 w-8 mb-2 ${role === "customer" ? "text-primary" : "text-muted-foreground"}`} />
              <p className="font-semibold text-foreground">Customer</p>
              <p className="text-xs text-muted-foreground mt-0.5">Hire workers</p>
            </button>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              disabled={loading}
              className="touch-target w-full rounded-lg border border-border bg-card pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
          </div>
        </div>

        {/* Phone */}
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
                placeholder="10-digit number"
                disabled={loading}
                className="touch-target w-full rounded-lg border border-border bg-card pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Preferred Language</label>
          <LanguageSelector className="w-full" />
        </div>

        {/* Terms */}
        <label className="flex items-start gap-3 touch-target cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-border accent-primary"
          />
          <span className="text-sm text-muted-foreground">
            I agree to the{" "}
            <button className="text-primary underline">Terms of Service</button> and{" "}
            <button className="text-primary underline">Privacy Policy</button>
          </span>
        </label>

        <LoadingButton
          loading={loading}
          onClick={handleRegister}
          disabled={!name || phone.length < 10 || !agreed}
        >
          Send OTP
        </LoadingButton>
      </div>

      <div className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <Link to="/login" className="text-sm font-medium text-primary underline underline-offset-4 touch-target">
          Already have an account? Login
        </Link>
      </div>
    </div>
  );
}
