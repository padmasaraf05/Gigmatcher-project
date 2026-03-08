import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Search, Phone, Mail, MessageSquare, Play, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";

const WORKER_FAQS = [
  { q: "How do I register as a worker?", a: "Download the app, sign up with your phone number, complete your profile with skills and tools, and you'll start receiving job matches in your area." },
  { q: "How do payments work?", a: "Payments are processed after job completion. Customers pay via UPI or card, and your earnings (minus 10% platform commission) are credited within 24 hours." },
  { q: "How are ratings calculated?", a: "Your rating is the average of all customer reviews. Maintaining a 4.0+ rating gives you priority in job matching and higher visibility." },
  { q: "What is the Pro subscription?", a: "Pro (₹99/month) gives you priority matching, demand alerts, unlimited job accepts, income PDF reports, and a Pro badge on your profile." },
];

const CUSTOMER_FAQS = [
  { q: "How do I book a service?", a: "Tap 'Book a Service' on the dashboard, select a category, describe your issue, choose a time slot, and we'll match you with verified workers nearby." },
  { q: "How do I track my worker?", a: "Once a worker accepts and is en route, you'll see live location tracking on the booking detail page with estimated arrival time." },
  { q: "What is the cancellation policy?", a: "You can cancel for free if the worker hasn't accepted yet. After acceptance, a ₹50 cancellation fee may apply. No fee if the worker cancels." },
  { q: "What if I have a payment issue?", a: "Go to your booking detail, tap 'View Receipt', and if there's a discrepancy, contact support via chat or call 1800-XXX-XXXX." },
];

const VIDEO_GUIDES = [
  { title: "Getting Started with GigMatcher", duration: "3:24" },
  { title: "How to Book Your First Service", duration: "2:15" },
  { title: "Managing Your Earnings", duration: "4:02" },
];

export default function HelpScreen() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const faqs = role === "worker" ? WORKER_FAQS : CUSTOMER_FAQS;
  const filtered = search ? faqs.filter((f) => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())) : faqs;

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Help & Support</h1>
      </header>

      <div className="px-4 py-4 space-y-6 pb-20">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search help articles..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* FAQs */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-3">
            {role === "worker" ? "Worker" : "Customer"} FAQs
          </h2>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No matching articles found.</p>
            ) : (
              filtered.map((faq, i) => <FAQItem key={i} question={faq.q} answer={faq.a} />)
            )}
          </div>
        </div>

        {/* Video Guides */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-3">Video Guides</h2>
          <div className="space-y-3">
            {VIDEO_GUIDES.map((v, i) => (
              <div key={i} className="flex gap-3 items-center p-3 rounded-xl bg-card border border-border">
                <div className="shrink-0 h-16 w-24 rounded-lg bg-muted flex items-center justify-center">
                  <Play className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-3">Contact Us</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/messages/support")}
              className="touch-target w-full flex items-center gap-3 p-4 rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              <MessageSquare className="h-5 w-5" /> Chat with Support
            </button>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <Phone className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">1800-XXX-XXXX</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <Mail className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">support@gigmatcher.in</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="touch-target w-full flex items-center justify-between p-4 text-left">
        <span className="text-sm font-semibold text-foreground pr-4">{question}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48" : "max-h-0"}`}>
        <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}
