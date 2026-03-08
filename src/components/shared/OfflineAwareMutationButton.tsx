import { useAuth } from "@/context/AuthContext";
import LoadingButton from "@/components/LoadingButton";
import { WifiOff } from "lucide-react";

interface OfflineAwareMutationButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
}

export default function OfflineAwareMutationButton({ loading, children, variant, ...props }: OfflineAwareMutationButtonProps) {
  const { isOnline } = useAuth();

  if (!isOnline) {
    return (
      <div className="relative w-full">
        <LoadingButton disabled variant={variant} {...props}>{children}</LoadingButton>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <WifiOff className="h-3 w-3" />
          <span>Unavailable while offline</span>
        </div>
      </div>
    );
  }

  return <LoadingButton loading={loading} variant={variant} {...props}>{children}</LoadingButton>;
}
