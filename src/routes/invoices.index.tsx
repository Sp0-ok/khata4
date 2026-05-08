import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, calcInvoiceTotals, type InvoiceStatus } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invoices/")({
  head: () => ({ meta: [{ title: "Invoices — Hisaab Kitaab" }] }),
  component: InvoicesList,
});

function InvoicesList() {
  const { format } = useCurrency();
  const [tab, setTab] = useState<"all" | InvoiceStatus>("all");
  const [q, setQ] = useState("");
  const invoices = useLiveQuery(
    () => db.invoices.toArray().then(arr => arr.sort((a, b) => b.createdAt - a.createdAt)),
    [],
  );

  const filtered = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .filter(i => tab === "all" || i.status === tab)
      .filter(i => !q || i.number.toLowerCase().includes(q.toLowerCase()) || i.partyName.toLowerCase().includes(q.toLowerCase()));
  }, [invoices, tab, q]);

  const totalUnpaid = (invoices || [])
    .filter(i => i.status !== "paid")
    .reduce((s, i) => s + Math.max(0, calcInvoiceTotals(i).total - (i.paidAmount || 0)), 0);
  const totalPaid = (invoices || [])
    .reduce((s, i) => s + (i.paidAmount || 0), 0);

  return (
    <AppShell>
      <PageHeader title="Invoices" subtitle="Bill parties, track payments" />

      <div className="space-y-3 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Card className="rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unpaid</p>
            <p className="text-base font-bold tabular text-[color:var(--debit)]">{format(totalUnpaid)}</p>
          </Card>
          <Card className="rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Collected</p>
            <p className="text-base font-bold tabular text-[color:var(--credit)]">{format(totalPaid)}</p>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice or party" className="h-11 rounded-xl pl-9" />
        </div>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="partial">Partial</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ul className="mt-3 space-y-2 px-4">
        {filtered.map(inv => {
          const { total } = calcInvoiceTotals(inv);
          const due = Math.max(0, total - (inv.paidAmount || 0));
          return (
            <li key={inv.id}>
              <Link to="/invoices/$id" params={{ id: String(inv.id) }}>
                <Card className="flex items-center gap-3 rounded-2xl p-3 hover:bg-accent/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{inv.number} · {inv.partyName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {new Date(inv.date).toLocaleDateString()} · {inv.items.length} item(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular">{format(total)}</p>
                    <span className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase",
                      inv.status === "paid" && "bg-[color:var(--credit)]/15 text-[color:var(--credit)]",
                      inv.status === "partial" && "bg-warning/20 text-warning-foreground",
                      inv.status === "sent" && "bg-primary/15 text-primary",
                      inv.status === "draft" && "bg-muted text-muted-foreground",
                    )}>
                      {inv.status === "partial" ? `Due ${format(due)}` : inv.status}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}

        {filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No invoices yet</p>
            <p className="text-xs text-muted-foreground">Tap + to create your first invoice.</p>
          </Card>
        )}
      </ul>

      <Link
        to="/invoices/new"
        className="fixed bottom-24 right-[max(1rem,calc(50%-13rem))] z-40 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-elevated)]"
        style={{ background: "var(--gradient-primary)" }}
        aria-label="New invoice"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </AppShell>
  );
}
