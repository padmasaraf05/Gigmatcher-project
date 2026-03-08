import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // For demo: show after 3 seconds
    const timer = setTimeout(() => {
      if (!window.matchMedia("(display-mode: standalone)").matches) {
        setShow(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
      } catch {}
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] p-4 animate-slide-up">
      <div className="rounded-2xl bg-card border border-border shadow-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Download className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Add GigMatcher</p>
              <p className="text-xs text-muted-foreground">to your home screen</p>
            </div>
          </div>
          <button onClick={() => setShow(false)} className="touch-target p-2 rounded-full hover:bg-muted transition-default">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Get the best experience with quick access, offline support, and push notifications.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleInstall}
            className="touch-target flex-1 rounded-lg bg-primary text-primary-foreground py-3 text-sm font-semibold hover:opacity-90 transition-default"
          >
            Add to Home Screen
          </button>
          <button
            onClick={() => setShow(false)}
            className="touch-target flex-1 rounded-lg py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-default"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
