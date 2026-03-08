import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Pencil, Trash2, Plus, X } from "lucide-react";
import LoadingButton from "@/components/LoadingButton";
import { EmptyState } from "@/components/shared";
import { toast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface Address {
  id: string;
  label: string;
  flat: string;
  street: string;
  city: string;
  pincode: string;
}

const INITIAL: Address[] = [
  { id: "1", label: "Home", flat: "B-204", street: "MG Road, Vijay Nagar", city: "Indore", pincode: "452010" },
  { id: "2", label: "Work", flat: "3rd Floor, TCS Campus", street: "Crystal IT Park", city: "Indore", pincode: "452001" },
];

let addressStore = [...INITIAL];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useAddresses() {
  return useQuery({ queryKey: ["addresses"], queryFn: async () => { await delay(300); return [...addressStore]; } });
}

function useAddressMutation() {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: async (a: Omit<Address, "id">) => { await delay(600); const n = { ...a, id: Date.now().toString() }; addressStore.push(n); return n; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); toast({ title: "Address added ✓" }); },
  });
  const edit = useMutation({
    mutationFn: async (a: Address) => { await delay(600); addressStore = addressStore.map((x) => (x.id === a.id ? a : x)); return a; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); toast({ title: "Address updated ✓" }); },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { await delay(600); addressStore = addressStore.filter((x) => x.id !== id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); toast({ title: "Address removed" }); },
  });
  return { add, edit, remove };
}

const emptyForm = { label: "", flat: "", street: "", city: "", pincode: "" };

export default function AddressesPage() {
  const navigate = useNavigate();
  const { data: addresses = [] } = useAddresses();
  const { add, edit, remove } = useAddressMutation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
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

  const renderForm = () => (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      {[
        { key: "label", placeholder: "Label (e.g. Home, Work)" },
        { key: "flat", placeholder: "Flat / House No" },
        { key: "street", placeholder: "Street" },
        { key: "city", placeholder: "City" },
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
      <div className="flex gap-2">
        <LoadingButton loading={edit.isPending || add.isPending} onClick={handleSave} disabled={!isValid} className="flex-1">
          Save
        </LoadingButton>
        <button onClick={() => { setEditingId(null); setAddingNew(false); }} className="touch-target rounded-lg border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-default">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="touch-target rounded-full p-2 hover:bg-muted transition-default">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">My Addresses</h1>
        {!addingNew && (
          <button onClick={startAdd} className="touch-target flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Add
          </button>
        )}
      </header>

      <div className="px-4 py-4 space-y-4 pb-24">
        {addingNew && renderForm()}

        {addresses.length === 0 && !addingNew && (
          <EmptyState icon={<MapPin className="h-12 w-12 text-muted-foreground" />} title="No saved addresses yet" subtitle="Add one!" action={<button onClick={startAdd} className="touch-target rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Add Address</button>} />
        )}

        {addresses.map((a) => (
          <div key={a.id} className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mb-1">
                    {a.label}
                  </span>
                  <p className="text-sm text-foreground">{a.flat}{a.flat ? ", " : ""}{a.street}</p>
                  <p className="text-xs text-muted-foreground">{a.city} {a.pincode}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(a)} className="touch-target p-2 rounded-full hover:bg-muted transition-default">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(a.id)} className="touch-target p-2 rounded-full hover:bg-destructive/10 transition-default">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
              {confirmDeleteId === a.id && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 p-2">
                  <span className="text-xs text-destructive font-medium flex-1">Are you sure?</span>
                  <button onClick={async () => { await remove.mutateAsync(a.id); setConfirmDeleteId(null); }} className="touch-target rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">
                    Yes
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)} className="touch-target rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
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
