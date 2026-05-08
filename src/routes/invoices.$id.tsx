import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ChevronLeft, FileDown, MessageCircle, MoreVertical, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, calcInvoiceTotals, type InvoiceStatus } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { downloadInvoice, shareWhatsApp } from "@/lib/pdf";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice — Hisaab Kitaab" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const iid = Number(id);
  const navigate = useNavigate();
  const { format } = useCurrency();
  const inv = useLiveQuery(() => db.invoices.get(iid), [iid]);
  const party = useLiveQuery(
    () => inv?.partyId ? db.parties.get(inv.partyId) : Promise.resolve(undefined),
    [inv?.partyId],
  );
  const [payAmt, setPayAmt] = useState("");

  if (inv === undefined) return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!inv) return <AppShell><div className="p-6">Invoice not found.</div></AppShell>;

  const totals = calcInvoiceTotals(inv);
  const due = Math.max(0, totals.total - (inv.paidAmount || 0));

  const setStatus = async (status: InvoiceStatus) => {
    await db.invoices.update(iid, { status });
    toast.success(`Marked ${status}`);
  };

  const recordPayment = async () => {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const newPaid = (inv.paidAmount || 0) + amt;
    const status: InvoiceStatus = newPaid >= totals.total ? "paid" : "partial";
    await db.invoices.update(iid, { paidAmount: newPaid, status });
    setPayAmt("");
    toast.success("Payment recorded");
  };

  const onDelete = async () => {
    await db.invoices.delete(iid);
    toast.success("Invoice deleted");
    navigate({ to: "/invoices" });
  };

  const onPDF = async () => {
    try { await downloadInvoice(inv); toast.success("Invoice downloaded"); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const onWhatsApp = () => {
    const msg = `Assalam-o-Alaikum ${inv.partyName}, please find your invoice ${inv.number} for ${format(totals.total)}.${due > 0 ? ` Balance due: ${format(due)}.` : " Fully paid — thank you!"}`;
    shareWhatsApp(party?.phone, msg);
  };

  return (
    <AppShell hideNav>
      <PageHeader
        title={inv.number}
        subtitle={inv.partyName}
        back={<Link to="/invoices" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full p-1 hover:bg-accent"><MoreVertical className="h-5 w-5" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPDF}><FileDown className="mr-2 h-4 w-4" /> Download PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={onWhatsApp}><MessageCircle className="mr-2 h-4 w-4" /> Share on WhatsApp</DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive" onSelect={e => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes {inv.number}.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <section className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 text-primary-foreground shadow-[var(--shadow-elevated)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <p className="text-[11px] uppercase tracking-widest opacity-80">Total</p>
          <p className="text-3xl font-bold tabular">{format(totals.total)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/15 p-2 backdrop-blur">
              <p className="opacity-80">Paid</p>
              <p className="font-semibold tabular">{format(inv.paidAmount || 0)}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-2 backdrop-blur">
              <p className="opacity-80">Due</p>
              <p className="font-semibold tabular">{format(due)}</p>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="px-4 pt-4">
        <Card className="space-y-2 rounded-2xl p-3">
          <div className="flex items-center justify-between text-xs">
            <Label className="text-muted-foreground">Status</Label>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              inv.status === "paid" && "bg-[color:var(--credit)]/15 text-[color:var(--credit)]",
              inv.status === "partial" && "bg-warning/20 text-warning-foreground",
              inv.status === "sent" && "bg-primary/15 text-primary",
              inv.status === "draft" && "bg-muted text-muted-foreground",
            )}>{inv.status}</span>
          </div>
          <Select value={inv.status} onValueChange={v => setStatus(v as InvoiceStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </Card>
      </section>

      <section className="px-4 pt-4">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Items</h2>
        <Card className="divide-y divide-border rounded-2xl">
          {inv.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{it.name}</p>
                <p className="text-[11px] text-muted-foreground">{it.qty} × {format(it.price)}</p>
              </div>
              <p className="font-semibold tabular">{format(it.qty * it.price)}</p>
            </div>
          ))}
        </Card>
      </section>

      <section className="px-4 pt-4">
        <Card className="space-y-1.5 rounded-2xl p-4 text-sm">
          <Row label="Subtotal" value={format(totals.subtotal)} />
          {inv.discount > 0 && <Row label="Discount" value={`- ${format(inv.discount)}`} />}
          {totals.tax > 0 && <Row label={`Tax (${inv.taxPercent}%)`} value={format(totals.tax)} />}
          <div className="my-1 border-t border-border" />
          <Row label="Total" value={format(totals.total)} bold />
        </Card>
      </section>

      {due > 0 && (
        <section className="px-4 pt-4">
          <Card className="space-y-2 rounded-2xl p-3">
            <Label className="text-xs text-muted-foreground">Record payment</Label>
            <div className="flex gap-2">
              <Input inputMode="decimal" type="number" step="0.01" min="0"
                placeholder={`Amount (max ${format(due)})`}
                value={payAmt} onChange={e => setPayAmt(e.target.value)} />
              <Button onClick={recordPayment} className="shrink-0">Add</Button>
            </div>
          </Card>
        </section>
      )}

      {inv.notes && (
        <section className="px-4 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Notes</h2>
          <Card className="rounded-2xl p-3 text-sm">{inv.notes}</Card>
        </section>
      )}

      <div className="sticky bottom-0 mt-6 grid grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur safe-bottom">
        <Button variant="outline" className="h-12" onClick={onWhatsApp}>
          <MessageCircle className="mr-2 h-4 w-4" /> Share
        </Button>
        <Button className="h-12" onClick={onPDF}>
          <FileDown className="mr-2 h-4 w-4" /> PDF
        </Button>
      </div>
    </AppShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
