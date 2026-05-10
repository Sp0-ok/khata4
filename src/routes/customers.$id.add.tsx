import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
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
import { db, type PaymentMethod, type TxnType } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { tapSuccess } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { formatAmountInput, parseAmountInput } from "@/lib/format";

const methods: PaymentMethod[] = ["cash", "bank", "easypaisa", "jazzcash", "card", "cheque", "other"];

export const Route = createFileRoute("/customers/$id/add")({
  validateSearch: (s: Record<string, unknown>) => ({
    type: (s.type as TxnType) || "credit",
  }),
  head: () => ({ meta: [{ title: "Add transaction — Hisaab Kitaab" }] }),
  component: AddTxn,
});

function AddTxn() {
  const { id } = Route.useParams();
  const { type } = useSearch({ from: "/customers/$id/add" });
  const navigate = useNavigate();
  const { symbol, settings } = useCurrency();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseAmountInput(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    try {
      const now = Date.now();
      await db.transactions.add({
        partyId: Number(id),
        type, amount: amt,
        note: note.trim() || undefined,
        method,
        date: new Date(date).getTime(),
        createdAt: now,
      });
      await db.parties.update(Number(id), { updatedAt: now });
      tapSuccess();
      toast.success(type === "credit" ? "Receipt recorded" : "Payment recorded");
      navigate({ to: "/customers/$id", params: { id }, replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const isCredit = type === "credit";

  return (
    <AppShell hideNav>
      <PageHeader
        title={isCredit ? "You got payment" : "You gave"}
        back={
          <Link to="/customers/$id" params={{ id }} className="rounded-full p-1 hover:bg-accent">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        }
      />

      <form onSubmit={submit} className="space-y-5 px-4 pb-8 pt-6">
        <div
          className={cn(
            "rounded-3xl p-5 text-white shadow-[var(--shadow-elevated)]",
          )}
          style={{ background: isCredit ? "var(--credit)" : "var(--debit)" }}
        >
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
        <Field label="Note">
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Optional details" maxLength={300} rows={3} />
        </Field>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3 safe-bottom">
          <Button type="submit" disabled={saving} className="h-12 w-full text-base font-semibold">
            {saving ? "Saving…" : `Save ${isCredit ? "receipt" : "payment"}`}
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
