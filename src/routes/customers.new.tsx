import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ChevronLeft, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { downscaleImage } from "@/lib/image";
import { Avatar } from "./customers.index";

export const Route = createFileRoute("/customers/new")({
  head: () => ({ meta: [{ title: "Add party — Hisaab Kitaab" }] }),
  component: NewParty,
});

function NewParty() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [opening, setOpening] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5MB)"); return; }
    try { setPhoto(await downscaleImage(f, 256)); } catch (err: any) { toast.error(err.message); }
    finally { e.target.value = ""; }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const now = Date.now();
      const id = await db.parties.add({
        name: name.trim(), phone: phone.trim() || undefined,
        email: email.trim() || undefined, address: address.trim() || undefined,
        notes: notes.trim() || undefined, photo,
        openingBalance: parseFloat(opening) || 0,
        createdAt: now, updatedAt: now,
      });
      toast.success("Party added");
      navigate({ to: "/customers/$id", params: { id: String(id) } });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell hideNav>
      <PageHeader
        title="Add party"
        back={<Link to="/customers" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
      />
      <form onSubmit={onSave} className="space-y-4 px-4 pb-8 pt-4">
        <div className="flex flex-col items-center gap-2 pt-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative">
            <Avatar name={name || "?"} photo={photo} size={88} />
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          {photo && (
            <button type="button" onClick={() => setPhoto(undefined)} className="flex items-center gap-1 text-xs text-muted-foreground">
              <X className="h-3 w-3" /> Remove photo
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
        </div>

        <Field label="Name *">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ali Traders" required maxLength={80} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" inputMode="tel" maxLength={20} />
        </Field>
        <Field label="Email">
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" type="email" maxLength={120} />
        </Field>
        <Field label="Address">
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Shop / area" maxLength={200} />
        </Field>
        <Field label="Opening balance">
          <Input
            value={opening} onChange={e => setOpening(e.target.value)}
            placeholder="0  (positive: they owe you, negative: you owe)"
            inputMode="decimal" type="number" step="0.01"
          />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={3} />
        </Field>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3 safe-bottom">
          <Button type="submit" disabled={saving} className="h-12 w-full text-base font-semibold">
            {saving ? "Saving…" : "Save party"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
