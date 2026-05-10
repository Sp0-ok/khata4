import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { db, type PaymentMethod, type TxnType } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { formatAmountInput, parseAmountInput } from "@/lib/format";

const methods: PaymentMethod[] = ["cash", "bank", "easypaisa", "jazzcash", "card", "cheque", "other"];

export const Route = createFileRoute("/customers/$id/txn/$txnId")({
  head: () => ({ meta: [{ title: "Edit transaction — Hisaab Kitaab" }] }),
  component: EditTxn,
});

function EditTxn() {
  const { id, txnId } = Route.useParams();
  const navigate = useNavigate();
  const { symbol, settings } = useCurrency();

  const [type, setType] = useState<TxnType>("debit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.transactions.get(Number(txnId)).then(t => {
      if (!t) { toast.error("Not found"); navigate({ to: "/customers/$id", params: { id } }); return; }
      setType(t.type);
      setAmount(formatAmountInput(String(t.amount), undefined));
      setNote(t.note || "");
      setMethod(t.method);
      setDate(new Date(t.date).toISOString().slice(0, 10));
      setLoaded(true);
    });
  }, [txnId, id, navigate]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseAmountInput(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    try {
      await db.transactions.update(Number(txnId), {
        type, amount: amt,
        note: note.trim() || undefined, method,
        date: new Date(date).getTime(),
        updatedAt: Date.now(),
      });
      await db.parties.update(Number(id), { updatedAt: Date.now() });
      toast.success("Transaction updated");
      navigate({ to: "/customers/$id", params: { id }, replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setSaving(false); }
  };

  if (!loaded) return <AppShell hideNav><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;

  const isCredit = type === "credit";

  return (
    <AppShell hideNav>
      <PageHeader
        title="Edit transaction"
        back={<Link to="/customers/$id" params={{ id }} className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
      />

      <form onSubmit={onSave} className="space-y-5 px-4 pb-8 pt-6">
        <Tabs value={type} onValueChange={v => setType(v as TxnType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="debit">You gave</TabsTrigger>
            <TabsTrigger value="credit">You got</TabsTrigger>
          </TabsList>
        </Tabs>

        <div
          className={cn("rounded-3xl p-5 text-white shadow-[var(--shadow-elevated)]")}
          style={{ background: isCredit ? "var(--credit)" : "var(--debit)" }}
        >
          <p className="text-xs uppercase tracking-widest opacity-90">Amount</p>
          <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold opacity-90">{symbol}</span>
            <input
              autoFocus type="text" inputMode="decimal" autoComplete="off"
              value={amount}
              onChange={e => setAmount(formatAmountInput(e.target.value, settings?.currency))}
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
          <Textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300} rows={3} />
        </Field>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3 safe-bottom">
          <Button type="submit" disabled={saving} className="h-12 w-full text-base font-semibold">
            {saving ? "Saving…" : "Save changes"}
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
