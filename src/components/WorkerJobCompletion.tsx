import { useState } from "react";
import LoadingButton from "@/components/LoadingButton";

interface WorkerJobCompletionProps {
  loading: boolean;
  onComplete: () => void;
}

export default function WorkerJobCompletion({ loading, onComplete }: WorkerJobCompletionProps) {
  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      <LoadingButton
        loading={loading}
        className="!bg-accent"
        onClick={() => setShowSheet(true)}
      >
        Mark as Complete
      </LoadingButton>

      {showSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/30 animate-fade-in"
            onClick={() => setShowSheet(false)}
          />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border p-5 animate-slide-up">
            <h3 className="text-base font-bold text-foreground mb-2">Complete Job?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Has the job been completed to the customer's satisfaction?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSheet(false)}
                className="flex-1 touch-target rounded-lg border border-border py-3 text-sm font-semibold text-foreground transition-default hover:bg-muted"
              >
                Cancel
              </button>
              <LoadingButton
                loading={loading}
                className="flex-1 !bg-accent"
                onClick={() => {
                  setShowSheet(false);
                  onComplete();
                }}
              >
                Yes, Complete
              </LoadingButton>
            </div>
          </div>
        </>
      )}
    </>
  );
}
