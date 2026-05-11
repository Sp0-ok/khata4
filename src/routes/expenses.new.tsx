import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { db, EXPENSE_CATEGORIES, type PaymentMethod } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { downscaleImage } from "@/lib/image";

const methods: PaymentMethod[] = ["cash", "bank", "easypaisa", "jazzcash", "card", "cheque", "other"];

export const Route = createFileRoute("/expenses/new")({
  validateSearch: (s: Record<string, unknown>) => ({ id: s.id ? Number(s.id) : undefined }),
  head: () => ({ meta: [{ title: "Add expense — Hisaab Kitaab" }] }),
  component: NewExpense,
});

function NewExpense() {
  const navigate = useNavigate();
  const { id: editId } = useSearch({ from: "/expenses/new" });
  const isEdit = editId != null;
  const { symbol, settings } = useCurrency();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [customCategory, setCustomCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setPhoto(await downscaleImage(f, 1024)); }
    catch (err: any) { toast.error(err.message || "Could not load image"); }
    finally { e.target.value = ""; }
  };

  useEffect(() => {
    if (!isEdit) return;
    db.expenses.get(editId!).then(e => {
      if (!e) { toast.error("Expense not found"); navigate({ to: "/expenses" }); return; }
      setTitle(e.title); setAmount(formatAmountInput(String(e.amount)));
      if (EXPENSE_CATEGORIES.includes(e.category)) {
        setCategory(e.category);
      } else {
        setCategory("Other"); setCustomCategory(e.category);
      }
      setVendor(e.vendor || ""); setMethod(e.method);
      setDate(new Date(e.date).toISOString().slice(0, 10));
      setNotes(e.notes || "");
      setPhoto(e.attachment);
    });
  }, [isEdit, editId, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    const amt = parseAmountInput(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const finalCategory = category === "Other" && customCategory.trim()
      ? customCategory.trim()
      : category;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        amount: amt,
        category: finalCategory,
        vendor: vendor.trim() || undefined,
        method,
        date: new Date(date).getTime(),
        notes: notes.trim() || undefined,
        attachment: photo,
      };
      if (isEdit) {
        await db.expenses.update(editId!, payload);
        toast.success("Expense updated");
      } else {
        await db.expenses.add({ ...payload, createdAt: Date.now() });
        toast.success("Expense saved");
      }
      navigate({ to: "/expenses" });
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <AppShell hideNav>
      <PageHeader
        title={isEdit ? "Edit expense" : "Add expense"}
        back={<Link to="/expenses" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
      />
      <form onSubmit={submit} className="space-y-4 px-4 pb-8 pt-4">
        <div className="rounded-3xl p-5 text-white shadow-[var(--shadow-elevated)]" style={{ background: "var(--debit)" }}>
          <p className="text-xs uppercase tracking-widest opacity-90">Amount</p>
          <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold opacity-90">{symbol}</span>
            <input
              autoFocus type="text" inputMode="decimal" autoComplete="off"
              value={amount}
              onChange={e => setAmount(formatAmountInput(e.target.value, settings?.currency))}
              placeholder="0"
              className="w-full bg-transparent text-4xl font-bold tabular outline-none placeholder:text-white/60"
            />
          </div>
        </div>

        <Field label="Title *">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Shop electricity" maxLength={120} required />
        </Field>
        <Field label="Category">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {category === "Other" && (
            <Input
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              placeholder="Custom category name (optional)"
              maxLength={40}
              className="mt-2"
            />
          )}
        </Field>
        <Field label="Vendor (optional)">
          <Input value={vendor} onChange={e => setVendor(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Payment method">
          <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              {methods.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={3} />
        </Field>

        <Field label="Photo / Receipt">
          {photo ? (
            <div className="relative inline-block">
              <img src={photo} alt="Receipt" className="max-h-44 rounded-xl border border-border object-contain" />
              <button type="button" onClick={() => setPhoto(undefined)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                aria-label="Remove photo">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={() => photoRef.current?.click()}>
              <ImagePlus className="mr-2 h-4 w-4" /> Add photo
            </Button>
          )}
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
        </Field>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3 safe-bottom">
          <Button type="submit" disabled={saving} className="h-12 w-full text-base font-semibold">
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save expense"}
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
