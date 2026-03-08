// src/pages/customer/BookService.tsx
// PHASE 11 FIX:
//   [FIX 1] handleLocate() — real GPS + detailed reverse-geocode (street level)
//   [FIX 2] handleSubmit() — geocodes manual address → lat/lng for job pin
//   [FIX 3] Manual address input now shows Nominatim autocomplete suggestions
//           as the user types (debounced 400ms, min 3 chars, India-biased)
//   ALL JSX structure, Tailwind classes, UI elements — IDENTICAL to original.

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import LoadingButton from "@/components/LoadingButton";
import { SERVICE_CATEGORIES, TOOLS_BY_SERVICE, PRICE_ESTIMATES } from "@/hooks/useCustomerApi";
import { geocodeAddress, reverseGeocode, searchAddressSuggestions, type AddressSuggestion } from "@/lib/geocode";
import { MapPin, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Urgent"];

export default function BookService() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("category") || "";

  const [category, setCategory]           = useState(preselected);
  const [description, setDescription]     = useState("");
  const [location, setLocation]           = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [date, setDate]                   = useState("");
  const [timeSlot, setTimeSlot]           = useState("");
  const [urgency, setUrgency]             = useState<"normal" | "urgent">("normal");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [gpsCoords, setGpsCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating]           = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  // [FIX 3] Autocomplete state
  const [suggestions, setSuggestions]     = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const tools    = category ? TOOLS_BY_SERVICE[category] || [] : [];
  const estimate = category ? PRICE_ESTIMATES[category] : null;

  useEffect(() => {
    if (category && tools.length > 0) setSelectedTools(tools);
  }, [category]);

  // Dismiss suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // [FIX 3] Debounced Nominatim autocomplete as user types
  const handleManualAddressChange = (value: string) => {
    setManualAddress(value);
    setGpsCoords(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await searchAddressSuggestions(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 400);
  };

  const handleSelectSuggestion = (s: AddressSuggestion) => {
    setManualAddress(s.shortName);
    setGpsCoords({ lat: s.lat, lng: s.lng });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // [FIX 1] Real GPS + detailed reverse-geocode (street level)
  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS unavailable", description: "Your device does not support geolocation" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        const addr = await reverseGeocode(lat, lng);
        const display = addr ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setLocation(display);
        setLocating(false);
        toast({ title: "Location detected", description: `📍 ${display}` });
      },
      (err) => {
        setLocating(false);
        toast({
          title: "Could not get location",
          description: err.message + " — please enter address manually",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // [FIX 2] Geocode address → lat/lng then navigate with coordinates
  const handleSubmit = async () => {
    const addressText = manualAddress.trim() || location || "";
    let coords = gpsCoords;

    if (!coords && addressText) {
      setSubmitting(true);
      coords = await geocodeAddress(addressText);
      setSubmitting(false);
      if (!coords) {
        toast({
          title: "Address not found on map",
          description: "Booking will proceed but live map won't show job location",
        });
      }
    }

    navigate("/customer/worker-selection", {
      state: {
        category,
        description,
        address:   addressText,
        latitude:  coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        date,
        timeSlot,
        urgency,
        selectedTools,
      },
    });
  };

  const canSubmit = category && (location || manualAddress) && date && timeSlot;

  // ── UI — IDENTICAL TO ORIGINAL ────────────────────────────────────────────
  return (
    <div className="px-4 py-5 space-y-6 animate-fade-in pb-6">
      <h2 className="text-xl font-bold text-foreground">Book a Service</h2>

      {/* Category Grid */}
      <div>
        <label className="text-sm font-semibold text-foreground mb-2 block">Service Type</label>
        <div className="grid grid-cols-3 gap-2.5">
          {SERVICE_CATEGORIES.map((svc) => (
            <button
              key={svc.id}
              onClick={() => setCategory(svc.id)}
              className={`touch-target rounded-xl border-2 p-3 flex flex-col items-center gap-1.5 transition-default ${
                category === svc.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="text-2xl">{svc.icon}</span>
              <span className="text-xs font-semibold text-foreground">{svc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Describe Your Issue</label>
        <Textarea
          placeholder="Describe your issue in detail..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Location — [FIX 1] real GPS, [FIX 3] autocomplete dropdown */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Location</label>
        <LoadingButton variant="outline" loading={locating} onClick={handleLocate}>
          <MapPin className="h-4 w-4" /> {location || "Use GPS Location"}
        </LoadingButton>

        {/* [FIX 3] Manual input with autocomplete */}
        <div className="relative" ref={suggestionsRef}>
          <Input
            placeholder="Or enter address manually"
            value={manualAddress}
            onChange={(e) => handleManualAddressChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoComplete="off"
          />
          {/* Suggestion dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-default flex items-start gap-2 border-b border-border last:border-0"
                >
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{s.shortName}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.displayName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Date & Time</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="touch-target w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
        />
        <div className="flex gap-2 flex-wrap">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => {
                setTimeSlot(slot);
                if (slot === "Urgent") setUrgency("urgent");
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-default ${
                timeSlot === slot
                  ? slot === "Urgent"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Urgency */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Urgency</label>
        <div className="flex gap-2">
          {(["normal", "urgent"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUrgency(u)}
              className={`flex-1 touch-target rounded-lg py-2.5 text-sm font-semibold capitalize transition-default ${
                urgency === u
                  ? u === "urgent"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Tools checklist */}
      {tools.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Required Tools</label>
          <div className="space-y-2">
            {tools.map((tool) => (
              <label
                key={tool}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 cursor-pointer"
              >
                <Checkbox
                  checked={selectedTools.includes(tool)}
                  onCheckedChange={(checked) =>
                    setSelectedTools((p) =>
                      checked ? [...p, tool] : p.filter((t) => t !== tool)
                    )
                  }
                />
                <span className="text-sm text-foreground">{tool}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Price Estimate */}
      {estimate && (
        <div className="rounded-xl bg-muted border border-border p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Estimated Price</p>
            <p className="text-lg font-bold text-foreground">{estimate}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Final price set by worker after assessment</p>
          </div>
        </div>
      )}

      {/* Submit */}
      <LoadingButton loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
        Find Available Workers
      </LoadingButton>
    </div>
  );
}