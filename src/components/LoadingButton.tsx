import { Loader2 } from "lucide-react";

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
}

export default function LoadingButton({
  loading,
  children,
  variant = "primary",
  className,
  disabled,
  ...props
}: LoadingButtonProps) {
  const base =
    "touch-target w-full rounded-lg font-semibold text-lg transition-default flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
    secondary: "bg-secondary text-secondary-foreground hover:opacity-90 active:scale-[0.98]",
    outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary/5 active:scale-[0.98]",
  };

  return (
    <button
      className={`${base} ${variants[variant]} py-3.5 ${className ?? ""}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin-slow" />
          <span>Please wait…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
