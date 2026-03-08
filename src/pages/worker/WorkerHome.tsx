export default function WorkerHome() {
  return (
    <div className="px-4 py-6 animate-fade-in-up">
      <h2 className="text-xl font-bold text-foreground mb-2">Welcome back! 👋</h2>
      <p className="text-muted-foreground mb-6">Find new gigs near you</p>

      <div className="grid grid-cols-2 gap-3">
        {["Available Jobs", "Active Gigs", "Earnings Today", "Reviews"].map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{item}</p>
            <p className="text-2xl font-bold text-foreground mt-1">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
