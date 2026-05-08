import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { db, calcInvoiceTotals, getSettings, nextInvoiceNumber, type InvoiceItem } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";

export const Route = createFileRoute("/invoices/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: s.id ? Number(s.id) : undefined,
  }),
  head: () => ({ meta: [{ title: "New invoice — Hisaab Kitaab" }] }),
  component: NewInvoice,
});

function NewInvoice() {
  const navigate = useNavigate();
  const { id: editId } = useSearch({ from: "/invoices/new" });
  const isEdit = editId != null;
  const { symbol, format } = useCurrency();
  const parties = useLiveQuery(() => db.parties.where("type").equals("customer").toArray(), []);

  const [number, setNumber] = useState("");
  const [partyId, setPartyId] = useState<string>("");
  const [partyName, setPartyName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ name: "", qty: 1, price: 0 }]);
  const [taxPercent, setTaxPercent] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (isEdit) {
        const inv = await db.invoices.get(editId!);
        if (!inv) { toast.error("Invoice not found"); navigate({ to: "/invoices" }); return; }
        setNumber(inv.number);
        setPartyId(inv.partyId ? String(inv.partyId) : "");
        setPartyName(inv.partyName);
        setDate(new Date(inv.date).toISOString().slice(0, 10));
        setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "");
        setItems(inv.items.length ? inv.items : [{ name: "", qty: 1, price: 0 }]);
        setTaxPercent(String(inv.taxPercent || 0));
        setDiscount(String(inv.discount || 0));
        setNotes(inv.notes || "");
      } else {
        setNumber(await nextInvoiceNumber());
        const s = await getSettings();
        setTaxPercent(String(s.taxPercent || 0));
      }
    })();
  }, [isEdit, editId, navigate]);

  const totals = calcInvoiceTotals({
    items, taxPercent: parseFloat(taxPercent) || 0, discount: parseFloat(discount) || 0,
  });

  const updateItem = (i: number, patch: Partial<InvoiceItem>) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const addItem = () => setItems([...items, { name: "", qty: 1, price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const onPartyChange = (v: string) => {
    setPartyId(v);
    if (v) {
      const p = parties?.find(p => String(p.id) === v);
      if (p) setPartyName(p.name);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) return toast.error("Select or enter a customer");
    const cleanItems = items.filter(i => i.name.trim() && i.qty > 0 && i.price >= 0);
    if (!cleanItems.length) return toast.error("Add at least one item");

    setSaving(true);
    try {
      if (isEdit) {
        await db.invoices.update(editId!, {
          number: number || (await nextInvoiceNumber()),
          partyId: partyId ? Number(partyId) : undefined,
          partyName: partyName.trim(),
          date: new Date(date).getTime(),
          dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
          items: cleanItems,
          taxPercent: parseFloat(taxPercent) || 0,
          discount: parseFloat(discount) || 0,
          notes: notes.trim() || undefined,
        });
        toast.success("Invoice updated");
        navigate({ to: "/invoices/$id", params: { id: String(editId) } });
      } else {
        const id = await db.invoices.add({
          number: number || (await nextInvoiceNumber()),
          partyId: partyId ? Number(partyId) : undefined,
          partyName: partyName.trim(),
          date: new Date(date).getTime(),
          dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
          items: cleanItems,
          taxPercent: parseFloat(taxPercent) || 0,
          discount: parseFloat(discount) || 0,
          notes: notes.trim() || undefined,
          status: "draft",
          paidAmount: 0,
          createdAt: Date.now(),
        });
        const s = await getSettings();
        if (s.id) await db.settings.update(s.id, { invoiceCounter: (s.invoiceCounter || 1) + 1 });
        toast.success("Invoice created");
        navigate({ to: "/invoices/$id", params: { id: String(id) } });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell hideNav>
      <PageHeader
        title={isEdit ? "Edit invoice" : "New invoice"}
        back={<Link to="/invoices" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
      />

      <form onSubmit={submit} className="space-y-4 px-4 pb-8 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice #">
            <Input value={number} onChange={e => setNumber(e.target.value)} maxLength={30} />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Customer">
          {parties && parties.length > 0 ? (
            <Select value={partyId} onValueChange={onPartyChange}>
              <SelectTrigger><SelectValue placeholder="Choose existing customer" /></SelectTrigger>
              <SelectContent>
                {parties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          <Input
            value={partyName} onChange={e => { setPartyName(e.target.value); setPartyId(""); }}
            placeholder="Or type a name" maxLength={80} className="mt-2"
          />
        </Field>

        <Field label="Due date (optional)">
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>

        <Card className="space-y-3 rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Items</p>
            <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8 rounded-lg">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/60 p-2.5">
              <Input
                value={it.name} onChange={e => updateItem(i, { name: e.target.value })}
                placeholder="Item name" maxLength={120}
              />
              <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <Input
                  inputMode="decimal" type="number" step="0.01" min="0" placeholder="Qty"
                  value={it.qty || ""} onChange={e => updateItem(i, { qty: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  inputMode="decimal" type="number" step="0.01" min="0" placeholder={`Price (${symbol})`}
                  value={it.price || ""} onChange={e => updateItem(i, { price: parseFloat(e.target.value) || 0 })}
                />
                <Button type="button" variant="ghost" size="icon" disabled={items.length === 1}
                  onClick={() => removeItem(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <p className="text-right text-xs font-medium tabular text-muted-foreground">
                {format(it.qty * it.price)}
              </p>
            </div>
          ))}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tax %">
            <Input inputMode="decimal" type="number" step="0.01" min="0" value={taxPercent}
              onChange={e => setTaxPercent(e.target.value)} />
          </Field>
          <Field label={`Discount (${symbol})`}>
            <Input inputMode="decimal" type="number" step="0.01" min="0" value={discount}
              onChange={e => setDiscount(e.target.value)} />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={3}
            placeholder="Payment terms, thank-you message…" />
        </Field>

        <Card className="space-y-1.5 rounded-2xl bg-accent/30 p-4">
          <Row label="Subtotal" value={format(totals.subtotal)} />
          {parseFloat(discount) > 0 && <Row label="Discount" value={`- ${format(parseFloat(discount))}`} />}
          {totals.tax > 0 && <Row label={`Tax (${taxPercent}%)`} value={format(totals.tax)} />}
          <div className="my-1 border-t border-border" />
          <Row label="Total" value={format(totals.total)} bold />
        </Card>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3 safe-bottom">
          <Button type="submit" disabled={saving} className="h-12 w-full text-base font-semibold">
            {saving ? "Saving…" : "Create invoice"}
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? "text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
