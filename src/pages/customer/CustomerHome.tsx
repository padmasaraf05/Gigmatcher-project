export default function CustomerHome() {
  return (
    <div className="px-4 py-6 animate-fade-in-up">
      <h2 className="text-xl font-bold text-foreground mb-2">Hello! 👋</h2>
      <p className="text-muted-foreground mb-6">What do you need help with today?</p>

      <div className="grid grid-cols-2 gap-3">
        {["Plumber", "Electrician", "Painter", "Cleaner"].map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-5 text-center transition-default hover:border-primary/50 hover:shadow-sm cursor-pointer active:scale-[0.97]">
            <p className="font-semibold text-foreground">{item}</p>
            <p className="text-xs text-muted-foreground mt-1">Book now</p>
          </div>
        ))}
      </div>
    </div>
  );
}
