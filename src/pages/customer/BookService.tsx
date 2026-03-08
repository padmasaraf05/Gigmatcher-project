// src/pages/customer/BookService.tsx
// POLISH:
//   [POLISH 1] Replaced static "Estimated Price" section with manual budget input
//   [POLISH 2] Added photo upload section (uploads to job-photos Supabase storage)
// ALL other JSX structure, Tailwind classes, UI elements — IDENTICAL to original.

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import LoadingButton from "@/components/LoadingButton";
import { SERVICE_CATEGORIES, TOOLS_BY_SERVICE } from "@/hooks/useCustomerApi";
import { geocodeAddress, reverseGeocode, searchAddressSuggestions, type AddressSuggestion } from "@/lib/geocode";
import { MapPin, Camera, X, IndianRupee } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

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

  // [POLISH 1] Customer budget
  const [budget, setBudget] = useState("");

  // [POLISH 2] Photo upload
  const [photos, setPhotos]           = useState<{ file: File; preview: string }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions]         = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const tools = category ? TOOLS_BY_SERVICE[category] || [] : [];

  useEffect(() => {
    if (category && tools.length > 0) setSelectedTools(tools);
  }, [category]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleManualAddressChange = (value: string) => {
    setManualAddress(value);
    setGpsCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
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
        toast({ title: "Could not get location", description: err.message + " — please enter address manually" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // [POLISH 2] Handle photo selection + preview
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > 5) {
      toast({ title: "Max 5 photos", description: "You can upload up to 5 photos" });
      return;
    }
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((p) => [...p, ...newPhotos]);
    // Reset input so same file can be re-selected
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((p) => {
      URL.revokeObjectURL(p[index].preview);
      return p.filter((_, i) => i !== index);
    });
  };

  // [POLISH 2] Upload photos to Supabase storage → return public URLs
  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0) return [];
    setUploadingPhotos(true);
    const urls: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < photos.length; i++) {
      const { file } = photos[i];
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `jobs/${timestamp}_${i}.${ext}`;

      const { error } = await supabase.storage
        .from("job-photos")
        .upload(path, file, { upsert: false });

      if (!error) {
        const { data: u } = supabase.storage.from("job-photos").getPublicUrl(path);
        urls.push(u.publicUrl);
      }
    }

    setUploadingPhotos(false);
    return urls;
  };

  const handleSubmit = async () => {
    const addressText = manualAddress.trim() || location || "";
    let coords = gpsCoords;

    setSubmitting(true);

    if (!coords && addressText) {
      coords = await geocodeAddress(addressText);
      if (!coords) {
        toast({
          title: "Address not found on map",
          description: "Booking will proceed but live map won't show job location",
        });
      }
    }

    // Upload photos first
    const photoUrls = await uploadPhotos();

    setSubmitting(false);

    navigate("/customer/worker-selection", {
      state: {
        category,
        description,
        address:       addressText,
        latitude:      coords?.lat   ?? null,
        longitude:     coords?.lng   ?? null,
        date,
        timeSlot,
        urgency,
        selectedTools,
        budget:        budget ? parseFloat(budget) : null,  // [POLISH 1]
        photoUrls,                                           // [POLISH 2]
      },
    });
  };

  const canSubmit = category && (location || manualAddress) && date && timeSlot;

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

      {/* [POLISH 2] Photo Upload */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">
          Upload Photos <span className="text-xs text-muted-foreground font-normal">(optional, max 5)</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-border">
              <img src={p.preview} alt="preview" className="h-full w-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-foreground/70 flex items-center justify-center"
              >
                <X className="h-3 w-3 text-background" />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <button
              onClick={() => photoInputRef.current?.click()}
              className="h-20 w-20 rounded-xl border-2 border-dashed border-border bg-muted flex flex-col items-center justify-center gap-1 transition-default hover:border-primary/50"
            >
              <Camera className="h-6 w-6 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Add photo</span>
            </button>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoSelect}
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Location</label>
        <LoadingButton variant="outline" loading={locating} onClick={handleLocate}>
          <MapPin className="h-4 w-4" /> {location || "Use GPS Location"}
        </LoadingButton>
        <div className="relative" ref={suggestionsRef}>
          <Input
            placeholder="Or enter address manually"
            value={manualAddress}
            onChange={(e) => handleManualAddressChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            autoComplete="off"
          />
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
              onClick={() => { setTimeSlot(slot); if (slot === "Urgent") setUrgency("urgent"); }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-default ${
                timeSlot === slot
                  ? slot === "Urgent" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
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
                  ? u === "urgent" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
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
                    setSelectedTools((p) => checked ? [...p, tool] : p.filter((t) => t !== tool))
                  }
                />
                <span className="text-sm text-foreground">{tool}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* [POLISH 1] Customer Budget — replaces static "Estimated Price" */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-foreground">Your Budget</label>
        <div className="relative">
          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            placeholder="Enter your budget (e.g. 500)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="pl-9"
            min={0}
          />
        </div>
        <p className="text-xs text-muted-foreground">Worker will see your budget before accepting the job</p>
      </div>

      {/* Submit */}
      <LoadingButton
        loading={submitting || uploadingPhotos}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {uploadingPhotos ? "Uploading photos..." : "Find Available Workers"}
      </LoadingButton>
    </div>
  );
}