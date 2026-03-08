import { useEffect } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <div className="fixed inset-0 bg-foreground/30 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-[430px] rounded-t-2xl bg-card p-5 pb-8 shadow-xl animate-slide-up z-10 max-h-[90vh] overflow-y-auto">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <button onClick={onClose} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
