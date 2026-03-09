// src/pages/AddressesPage.tsx
// [REWRITE] Wired to Supabase addresses table (was in-memory mock).
// Geocodes each saved address to lat/lng via Nominatim (free, no API key).
// UI and Tailwind classes are IDENTICAL to the original.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Pencil, Trash2, Plus } from "lucide-react";
import LoadingButton from "@/components/LoadingButton";
import { EmptyState } from "@/components/shared";
import { toast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Address {
  id: string;
  label: string;
  flat: string;
  street: string;
  city: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
}

// ─── Geocoding (Nominatim — free, no API key needed) ──────────────────────────

async function geocodeAddress(
  flat: string,
  street: string,
  city: string,
  pincode: string
): Promise<{ lat: number; lng: number } | null> {
  // Build a readable address string for geocoding
  const parts = [flat, street, city, pincode, "India"].filter(Boolean);
  const query = parts.join(", ");
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      {
        headers: {
          // Nominatim requires a descriptive User-Agent
          "User-Agent": "GigMatcher/1.0 (gigmatcher@example.com)",
          "Accept-Language": "en",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { lat: string; lon: string }[];
    if (!data?.[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null; // silently fail — address still saves without coordinates
  }
}

// ─── Supabase hooks ───────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

function useAddresses() {
  return useQuery<Address[]>({
    queryKey: ["addresses"],
    queryFn: async () => {
      const uid = await getCurrentUserId();
      const { data, error } = await supabase
        .from("addresses")
        .select("id, label, flat, street, city, pincode, lat, lng")
        .eq("user_id", uid)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id:      row.id,
        label:   row.label,
        flat:    row.flat    ?? "",
        street:  row.street,
        city:    row.city,
        pincode: row.pincode ?? "",
        lat:     row.lat     ?? null,
        lng:     row.lng     ?? null,
      }));
    },
  });
}

function useAddressMutation() {
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: async (a: Omit<Address, "id" | "lat" | "lng">) => {
      const uid   = await getCurrentUserId();
      const coords = await geocodeAddress(a.flat, a.street, a.city, a.pincode);
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: uid,
          label:   a.label,
          flat:    a.flat,
          street:  a.street,
          city:    a.city,
          pincode: a.pincode,
          lat:     coords?.lat ?? null,
          lng:     coords?.lng ?? null,
        })
        .select("id, label, flat, street, city, pincode, lat, lng")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ title: "Address added ✓" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save address", description: err.message });
    },
  });

  const edit = useMutation({
    mutationFn: async (a: Omit<Address, "lat" | "lng">) => {
      const coords = await geocodeAddress(a.flat, a.street, a.city, a.pincode);
      const { data, error } = await supabase
        .from("addresses")
        .update({
          label:   a.label,
          flat:    a.flat,
          street:  a.street,
          city:    a.city,
          pincode: a.pincode,
          lat:     coords?.lat ?? null,
          lng:     coords?.lng ?? null,
        })
        .eq("id", a.id)
        .select("id, label, flat, street, city, pincode, lat, lng")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ title: "Address updated ✓" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update address", description: err.message });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("addresses").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["addresses"] });
      toast({ title: "Address removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not remove address", description: err.message });
    },
  });

  return { add, edit, remove };
}

// ─── Component — UI IDENTICAL to original ─────────────────────────────────────

const emptyForm = { label: "", flat: "", street: "", city: "", pincode: "" };

export default function AddressesPage() {
  const navigate = useNavigate();
  const { data: addresses = [] } = useAddresses();
  const { add, edit, remove }   = useAddressMutation();
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [addingNew,       setAddingNew]       = useState(false);
  const [form,            setForm]            = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (a: Address) => {
    setAddingNew(false);
    setEditingId(a.id);
    setForm({ label: a.label, flat: a.flat, street: a.street, city: a.city, pincode: a.pincode });
  };

  const startAdd = () => {
    setEditingId(null);
    setAddingNew(true);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.label || !form.street || !form.city) return;
    if (editingId) {
      await edit.mutateAsync({ id: editingId, ...form });
      setEditingId(null);
    } else {
      await add.mutateAsync(form);
      setAddingNew(false);
    }
    setForm(emptyForm);
  };

  const isValid = form.label && form.street && form.city;
  const isSaving = edit.isPending || add.isPending;

  const renderForm = () => (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      {[
        { key: "label",   placeholder: "Label (e.g. Home, Work)" },
        { key: "flat",    placeholder: "Flat / House No" },
        { key: "street",  placeholder: "Street" },
        { key: "city",    placeholder: "City" },
        { key: "pincode", placeholder: "Pincode" },
      ].map((f) => (
        <input
          key={f.key}
          value={form[f.key as keyof typeof form]}
          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
          placeholder={f.placeholder}
          className="touch-target w-full rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ))}
      {/* Geocoding notice */}
      <p className="text-[11px] text-muted-foreground px-1">
        📍 Location will be auto-detected from your address for distance matching.
      </p>
      <div className="flex gap-2">
        <LoadingButton
          loading={isSaving}
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1"
        >
          {isSaving ? "Saving…" : "Save"}
        </LoadingButton>
        <button
          onClick={() => { setEditingId(null); setAddingNew(false); }}
          className="touch-target rounded-lg border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-default"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="touch-target rounded-full p-2 hover:bg-muted transition-default"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">My Addresses</h1>
        {!addingNew && (
          <button
            onClick={startAdd}
            className="touch-target flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        )}
      </header>

      <div className="px-4 py-4 space-y-4 pb-24">
        {addingNew && renderForm()}

        {addresses.length === 0 && !addingNew && (
          <EmptyState
            icon={<MapPin className="h-12 w-12 text-muted-foreground" />}
            title="No saved addresses yet"
            subtitle="Add one!"
            action={
              <button
                onClick={startAdd}
                className="touch-target rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Add Address
              </button>
            }
          />
        )}

        {addresses.map((a) => (
          <div key={a.id} className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-1">
                    {a.label}
                  </span>
                  <p className="text-sm text-foreground">
                    {a.flat}{a.flat ? ", " : ""}{a.street}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.city} {a.pincode}
                  </p>
                  {/* Show geocode status */}
                  {a.lat && a.lng ? (
                    <p className="text-[11px] text-accent mt-0.5">
                      📍 Location detected
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      📍 Location not detected — try editing with more detail
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(a)}
                    className="touch-target p-2 rounded-full hover:bg-muted transition-default"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(a.id)}
                    className="touch-target p-2 rounded-full hover:bg-destructive/10 transition-default"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>

              {confirmDeleteId === a.id && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 p-2">
                  <span className="text-xs text-destructive font-medium flex-1">Are you sure?</span>
                  <button
                    onClick={async () => { await remove.mutateAsync(a.id); setConfirmDeleteId(null); }}
                    className="touch-target rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="touch-target rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            {editingId === a.id && renderForm()}
          </div>
        ))}
      </div>
    </div>
  );
}