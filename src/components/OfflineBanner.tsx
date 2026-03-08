import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineBanner() {
  const { isOnline } = useAuth();
  const [showReconnect, setShowReconnect] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnect(false);
    } else if (wasOffline) {
      setShowReconnect(true);
      const timer = setTimeout(() => {
        setShowReconnect(false);
        setWasOffline(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline && showReconnect) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium bg-accent text-accent-foreground animate-slide-up">
        <Wifi className="h-4 w-4" />
        <span>Back online!</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="offline-banner flex items-center justify-center gap-2 animate-slide-up">
      <WifiOff className="h-4 w-4" />
      <span>You are offline. Showing cached data.</span>
    </div>
  );
}
