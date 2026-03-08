import { useAuth } from "@/context/AuthContext";
import { LANGUAGES, LanguageCode } from "@/lib/types";
import { Globe } from "lucide-react";

export default function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage } = useAuth();

  return (
    <div className={`relative inline-flex items-center gap-2 ${className ?? ""}`}>
      <Globe className="h-4 w-4 text-muted-foreground" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="touch-target appearance-none bg-transparent pr-6 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-md px-2 py-2 border border-border"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
