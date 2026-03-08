// src/components/CountdownRing.tsx
// POLISH [ISSUE 5]:
//   - isUrgent threshold changed to <=30s (works for both 60s and 300s timers)
//   - Display changed from "{timeLeft}s" → "M:SS" format so 300s shows "5:00"
//   - total prop default unchanged (60) — WorkerJobDetail passes total={300}
// ALL SVG structure, Tailwind classes, animation — IDENTICAL to original.

import { useEffect, useState } from "react";

interface CountdownRingProps {
  seconds: number;
  total?: number;
  size?: number;
  strokeWidth?: number;
  onComplete?: () => void;
}

export default function CountdownRing({
  seconds,
  total = 60,
  size = 64,
  strokeWidth = 4,
  onComplete,
}: CountdownRingProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    setTimeLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => setTimeLeft((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, onComplete]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / total;
  const offset = circumference * (1 - progress);

  // [POLISH 5] 30s threshold works correctly for both 60s and 5min timers
  const isUrgent = timeLeft <= 30;

  // [POLISH 5] Format as M:SS when >= 60s total, otherwise plain seconds
  const formatTime = (secs: number): string => {
    if (total >= 60) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    return `${secs}s`;
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isUrgent ? "hsl(var(--destructive))" : "hsl(var(--secondary))"}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <span className={`absolute text-xs font-bold ${isUrgent ? "text-destructive" : "text-foreground"}`}>
        {formatTime(timeLeft)}
      </span>
    </div>
  );
}