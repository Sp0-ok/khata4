import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
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

const methods: PaymentMethod[] = ["cash", "bank", "easypaisa", "jazzcash", "card", "cheque", "other"];

export const Route = createFileRoute("/expenses/new")({
  head: () => ({ meta: [{ title: "Add expense — Hisaab Kitaab" }] }),
  component: NewExpense,
});

function NewExpense() {
  const navigate = useNavigate();
  const { symbol } = useCurrency();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [vendor, setVendor] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    try {
      await db.expenses.add({
        title: title.trim(),
        amount: amt,
        category,
        vendor: vendor.trim() || undefined,
        method,
        date: new Date(date).getTime(),
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
      });
      toast.success("Expense saved");
      navigate({ to: "/expenses" });
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <AppShell hideNav>
      <PageHeader
        title="Add expense"
        back={<Link to="/expenses" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
      />
      <form onSubmit={submit} className="space-y-4 px-4 pb-8 pt-4">
        <div className="rounded-3xl p-5 text-white shadow-[var(--shadow-elevated)]" style={{ background: "var(--debit)" }}>
          <p className="text-xs uppercase tracking-widest opacity-90">Amount</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold opacity-90">{symbol}</span>
            <input
              autoFocus type="number" inputMode="decimal" step="0.01" min="0"
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
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

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3 safe-bottom">
          <Button type="submit" disabled={saving} className="h-12 w-full text-base font-semibold">
            {saving ? "Saving…" : "Save expense"}
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
