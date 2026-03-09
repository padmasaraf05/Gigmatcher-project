import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import LanguageSelector from "@/components/LanguageSelector";
import { Briefcase, Wrench } from "lucide-react";
import { useEffect } from "react";

export default function SplashPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

  useEffect(() => {
    if (isAuthenticated && role) {
      navigate(`/${role}`, { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  return (
    <div className="app-shell flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="animate-fade-in-up mb-8 flex flex-col items-center" style={{ animationDelay: "0ms" }}>
        {/* [CHANGE] Replaced Briefcase icon div with actual logo image */}
        <img
          src="/icons/icon-192.png"
          alt="GigMatcher logo"
          className="mb-4 h-20 w-20 rounded-2xl shadow-lg"
        />
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Gig<span className="text-primary">Matcher</span>
        </h1>
        <p className="mt-2 text-center text-lg text-muted-foreground">
          Find the right gig worker, instantly.
        </p>
      </div>

      {/* CTA Buttons */}
      <div className="w-full space-y-4 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <button
          onClick={() => navigate("/register?role=customer")}
          className="touch-target w-full rounded-xl border-2 border-primary bg-primary/5 p-5 transition-default hover:bg-primary/10 active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Briefcase className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-foreground">I need a Worker</p>
              <p className="text-sm text-muted-foreground">Find skilled gig workers near you</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/register?role=worker")}
          className="touch-target w-full rounded-xl border-2 border-secondary bg-secondary/5 p-5 transition-default hover:bg-secondary/10 active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
              <Wrench className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-foreground">I am a Worker</p>
              <p className="text-sm text-muted-foreground">Find gigs and earn money</p>
            </div>
          </div>
        </button>
      </div>

      {/* Bottom section */}
      <div className="mt-10 flex flex-col items-center gap-4 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
        <LanguageSelector />
        <button
          onClick={() => navigate("/login")}
          className="text-sm font-medium text-primary underline underline-offset-4 touch-target"
        >
          Already have an account? Login
        </button>
      </div>
    </div>
  );
}