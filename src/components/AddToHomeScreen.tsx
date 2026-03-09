// src/components/AddToHomeScreen.tsx
// PWA "Add to Home Screen" smart banner.
//
// Behaviour:
//   Android/Chrome: intercepts the native `beforeinstallprompt` event and shows
//     a custom bottom banner. Tapping "Install" triggers the native prompt.
//   iOS/Safari: detects iOS + standalone not already installed, shows a banner
//     with manual "Share → Add to Home Screen" instructions.
//   Already installed (standalone mode): renders nothing.
//   Dismissed: stores flag in localStorage, never shows again for 30 days.

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari(): boolean {
  return /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
}

const DISMISS_KEY   = "gigmatcher_a2hs_dismissed";
const DISMISS_DAYS  = 30;

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); }
  catch { /* ignore */ }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid,    setShowAndroid]    = useState(false);
  const [showIOS,        setShowIOS]        = useState(false);
  const [installing,     setInstalling]     = useState(false);

  useEffect(() => {
    // Never show if already installed or recently dismissed
    if (isStandalone() || wasDismissedRecently()) return;

    // Android / Chrome — intercept native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so the page feels settled before showing banner
      setTimeout(() => setShowAndroid(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari — show manual instructions
    if (isIOS() && isSafari()) {
      setTimeout(() => setShowIOS(true), 3000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setInstalling(false);
    setShowAndroid(false);
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      markDismissed(); // installed — never prompt again
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setShowAndroid(false);
    setShowIOS(false);
  };

  // ── Android banner ──────────────────────────────────────────────────────
  if (showAndroid) {
    return (
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-[400px] animate-slide-up"
        role="banner"
        aria-label="Install GigMatcher"
      >
        <div className="rounded-2xl border border-border bg-card shadow-xl p-4 flex items-center gap-3">
          {/* App icon */}
          <div className="shrink-0 h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <span className="text-2xl select-none">🔧</span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">
              Add GigMatcher to Home Screen
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              One-tap access, works offline
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-default hover:bg-primary/90 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {installing ? "Installing…" : "Install"}
            </button>
            <button
              onClick={handleDismiss}
              className="touch-target h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-default"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS banner ──────────────────────────────────────────────────────────
  if (showIOS) {
    return (
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-[400px] animate-slide-up"
        role="banner"
        aria-label="Install GigMatcher on iOS"
      >
        <div className="rounded-2xl border border-border bg-card shadow-xl p-4">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="shrink-0 h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-xl select-none">🔧</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Install GigMatcher</p>
              <p className="text-xs text-muted-foreground">Add to your home screen</p>
            </div>
            <button
              onClick={handleDismiss}
              className="touch-target h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-default"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Steps */}
          <ol className="space-y-2">
            <li className="flex items-center gap-2.5 text-xs text-foreground">
              <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">1</span>
              <span>
                Tap the{" "}
                <span className="inline-flex items-center gap-0.5 font-semibold">
                  <Share className="h-3.5 w-3.5 text-primary" /> Share
                </span>{" "}
                button in Safari's toolbar
              </span>
            </li>
            <li className="flex items-center gap-2.5 text-xs text-foreground">
              <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">2</span>
              <span>
                Scroll down and tap{" "}
                <span className="font-semibold">"Add to Home Screen"</span>
              </span>
            </li>
            <li className="flex items-center gap-2.5 text-xs text-foreground">
              <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Tap <span className="font-semibold">"Add"</span> in the top-right corner</span>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return null;
}