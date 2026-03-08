import BottomSheet from "./BottomSheet";
import LoadingButton from "@/components/LoadingButton";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "primary" | "secondary" | "outline";
  destructive?: boolean;
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen, title, body, confirmLabel = "Confirm", onConfirm, onCancel, variant = "primary", destructive, loading,
}: ConfirmDialogProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-sm text-muted-foreground mb-6">{body}</p>
      <div className="flex flex-col gap-3">
        <LoadingButton
          loading={loading}
          onClick={onConfirm}
          variant={variant}
          className={destructive ? "!bg-destructive !text-destructive-foreground" : ""}
        >
          {confirmLabel}
        </LoadingButton>
        <button
          onClick={onCancel}
          className="touch-target w-full rounded-lg py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-default"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
}
