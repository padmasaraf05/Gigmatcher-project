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

  const isUrgent = timeLeft <= 10;

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
      <span className={`absolute text-sm font-bold ${isUrgent ? "text-destructive" : "text-foreground"}`}>
        {timeLeft}s
      </span>
    </div>
  );
}
