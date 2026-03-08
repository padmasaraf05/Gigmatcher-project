interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      {actionLabel && (
        <button onClick={onAction} className="text-xs font-semibold text-primary hover:underline">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
