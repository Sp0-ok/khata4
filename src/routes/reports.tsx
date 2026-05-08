import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { BarChart3, LineChart as LineIcon } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  db,
  getAllBalances,
  calcInvoiceTotals,
  EXPENSE_CATEGORIES,
  type Expense,
  type Invoice,
  type Transaction,
} from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Hisaab Kitaab" }] }),
  component: Reports,
});

type Period = "1m" | "3m" | "6m" | "12m" | "all";
type View = "parties" | "business";
type ChartKind = "bars" | "lines";

type PartyBucket = { name: string; received: number; given: number };
type BizBucket = { name: string; sales: number; expenses: number };

const PERIOD_MONTHS: Record<Period, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12, all: 0 };
const PERIOD_LABEL: Record<Period, string> = { "1m": "1M", "3m": "3M", "6m": "6M", "12m": "1Y", all: "All" };

function Reports() {
  const { format } = useCurrency();
  const [view, setView] = useState<View>("parties");
  const [chartKind, setChartKind] = useState<ChartKind>("bars");
  const [period, setPeriod] = useState<Period>("6m");

  const balances = useLiveQuery(() => getAllBalances(), []);
  const txns = useLiveQuery(() => db.transactions.toArray(), []);
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const expenses = useLiveQuery(() => db.expenses.toArray(), []);

  const cutoffTs = useMemo(() => {
    if (period === "all") return 0;
    const d = new Date();
    d.setMonth(d.getMonth() - (PERIOD_MONTHS[period] - 1));
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [period]);

  const fTxns = useMemo(() => (txns || []).filter(t => t.date >= cutoffTs), [txns, cutoffTs]);
  const fInvoices = useMemo(() => (invoices || []).filter(i => i.date >= cutoffTs), [invoices, cutoffTs]);
  const fExpenses = useMemo(() => (expenses || []).filter(e => e.date >= cutoffTs), [expenses, cutoffTs]);

  const partyTotals = useMemo(() => ({
    received: fTxns.filter(x => x.type === "credit").reduce((s, x) => s + x.amount, 0),
    given: fTxns.filter(x => x.type === "debit").reduce((s, x) => s + x.amount, 0),
  }), [fTxns]);

  const bizTotals = useMemo(() => {
    const sales = fInvoices.reduce((s, i) => s + calcInvoiceTotals(i).total, 0);
    const exp = fExpenses.reduce((s, e) => s + e.amount, 0);
    return { sales, expenses: exp, profit: sales - exp };
  }, [fInvoices, fExpenses]);

  const monthlyParties = useMemo(
    () => buildPartyBuckets(fTxns, period),
    [fTxns, period],
  );
  const monthlyBiz = useMemo(
    () => buildBizBuckets(fInvoices, fExpenses, period),
    [fInvoices, fExpenses, period],
  );

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    EXPENSE_CATEGORIES.forEach(c => map.set(c, 0));
    fExpenses.forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries())
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [fExpenses]);

  const top = useMemo(() => [...(balances || [])]
    .filter(b => b.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 5), [balances]);

  const periodLabel = period === "all" ? "All time" : `Last ${PERIOD_LABEL[period]}`;

  return (
    <AppShell>
      <PageHeader title="Reports" subtitle={view === "parties" ? "Receivables & payables" : "Invoices & expenses"} />

      <div className="space-y-3 px-4 pt-4">
        <Tabs value={view} onValueChange={v => setView(v as View)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parties">Parties</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold",
                period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        <Tabs value={chartKind} onValueChange={v => setChartKind(v as ChartKind)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bars"><BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Bars</TabsTrigger>
            <TabsTrigger value="lines"><LineIcon className="mr-1.5 h-3.5 w-3.5" /> Trend</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "parties" ? (
        <>
          <section className="grid grid-cols-2 gap-2 px-4 pt-4">
            <MiniCard label="Received (You got)" value={format(partyTotals.received)} tone="credit" />
            <MiniCard label="Given (You gave)" value={format(partyTotals.given)} tone="debit" />
          </section>

          <section className="px-4 pt-4">
            <SimpleChart
              title={`${periodLabel} · Parties`}
              data={monthlyParties}
              kind={chartKind}
              series={[
                { key: "received", label: "Received", color: "var(--credit)" },
                { key: "given", label: "Given", color: "var(--debit)" },
              ]}
            />
          </section>

          <section className="px-4 pt-4">
            <Card className="rounded-2xl p-4">
              <h3 className="text-sm font-semibold">Top open balances</h3>
              <ul className="mt-3 space-y-2">
                {top.length === 0 && <li className="text-xs text-muted-foreground">No open balances.</li>}
                {top.map(({ party, balance }) => (
                  <li key={party.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-medium">{party.name}</p>
                      <p className="text-[11px] text-muted-foreground">{party.phone || "Party"}</p>
                    </div>
                    <p className={cn("text-sm font-bold tabular", balance > 0 ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]")}>
                      {format(Math.abs(balance))}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 px-4 pt-4">
            <MiniCard label="Sales" value={format(bizTotals.sales)} tone="credit" />
            <MiniCard label="Expenses" value={format(bizTotals.expenses)} tone="debit" />
            <MiniCard label="Profit" value={format(bizTotals.profit)} tone={bizTotals.profit >= 0 ? "credit" : "debit"} />
          </section>

          <section className="px-4 pt-4">
            <SimpleChart
              title={`${periodLabel} · Business`}
              data={monthlyBiz}
              kind={chartKind}
              series={[
                { key: "sales", label: "Sales", color: "var(--credit)" },
                { key: "expenses", label: "Expenses", color: "var(--debit)" },
              ]}
            />
          </section>

          {expenseByCategory.length > 0 && (
            <section className="px-4 pt-4">
              <Card className="rounded-2xl p-4">
                <h3 className="text-sm font-semibold">Expenses by category</h3>
                <div className="mt-3 space-y-2">
                  {expenseByCategory.map(item => (
                    <ProgressRow
                      key={item.name}
                      label={item.name}
                      value={format(item.value)}
                      ratio={item.value / Math.max(...expenseByCategory.map(x => x.value), 1)}
                    />
                  ))}
                </div>
              </Card>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

function MiniCard({ label, value, tone }: { label: string; value: string; tone: "credit" | "debit" }) {
  return (
    <Card className="rounded-2xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-base font-bold tabular", tone === "credit" ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]")}>
        {value}
      </p>
    </Card>
  );
}

function SimpleChart<T extends Record<string, number | string>>({
  title,
  data,
  kind,
  series,
}: {
  title: string;
  data: T[];
  kind: ChartKind;
  series: Array<{ key: Extract<keyof T, string>; label: string; color: string }>;
}) {
  const max = Math.max(1, ...data.flatMap(item => series.map(s => Number(item[s.key]) || 0)));

  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          {series.map(s => (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className={cn("mt-4 grid h-56 items-end gap-2", data.length > 12 ? "grid-cols-12 overflow-x-auto" : "grid-flow-col auto-cols-fr")}>
        {data.map(item => (
          <div key={String(item.name)} className="flex h-full min-w-8 flex-col justify-end gap-1">
            <div className="flex flex-1 items-end justify-center gap-1 rounded-lg bg-muted/40 px-1 py-1">
              {series.map(s => {
                const pct = Math.max(2, (Number(item[s.key]) || 0) / max * 100);
                return (
                  <div
                    key={s.key}
                    className={cn("w-full max-w-4 rounded-t-sm", kind === "lines" && "rounded-full")}
                    style={{ height: `${pct}%`, background: s.color }}
                    title={`${s.label}: ${Number(item[s.key]) || 0}`}
                  />
                );
              })}
            </div>
            <p className="truncate text-center text-[10px] text-muted-foreground">{item.name}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProgressRow({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-full rounded-full bg-[color:var(--debit)]" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

function buildPartyBuckets(items: Transaction[], period: Period): PartyBucket[] {
  const buckets = buildEmptyBuckets<PartyBucket>(items, period, { received: 0, given: 0 });
  fillBuckets(items, buckets, period, (it, bucket) => {
    if (it.type === "credit") bucket.received += it.amount;
    else bucket.given += it.amount;
  });
  return buckets;
}

function buildBizBuckets(invoices: Invoice[], expenses: Expense[], period: Period): BizBucket[] {
  const dated = [
    ...invoices.map(i => ({ date: i.date, type: "invoice" as const, amount: calcInvoiceTotals(i).total })),
    ...expenses.map(e => ({ date: e.date, type: "expense" as const, amount: e.amount })),
  ];
  const buckets = buildEmptyBuckets<BizBucket>(dated, period, { sales: 0, expenses: 0 });
  fillBuckets(dated, buckets, period, (it, bucket) => {
    if (it.type === "invoice") bucket.sales += it.amount;
    else bucket.expenses += it.amount;
  });
  return buckets;
}

function buildEmptyBuckets<B extends { name: string }>(items: { date: number }[], period: Period, init: Omit<B, "name">): B[] {
  const now = new Date();
  if (period === "1m") {
    const days = now.getDate();
    return Array.from({ length: days }, (_, i) => ({ ...init, name: String(i + 1) }) as B);
  }

  const count = period === "all" ? Math.max(1, monthsSpan(items)) : PERIOD_MONTHS[period];
  return Array.from({ length: count }, (_, idx) => {
    const i = count - 1 - idx;
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      ...init,
      name: d.toLocaleDateString(undefined, { month: "short", ...(count > 12 ? { year: "2-digit" } : {}) }),
    } as B;
  });
}

function fillBuckets<T extends { date: number }, B extends { name: string }>(
  items: T[],
  buckets: B[],
  period: Period,
  add: (item: T, bucket: B) => void,
) {
  const now = new Date();
  items.forEach(item => {
    const d = new Date(item.date);
    let idx = -1;
    if (period === "1m") {
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) idx = d.getDate() - 1;
    } else {
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      idx = buckets.length - 1 - diff;
    }
    if (idx >= 0 && idx < buckets.length) add(item, buckets[idx]);
  });
}

function monthsSpan(items: { date: number }[]): number {
  if (!items.length) return 6;
  const now = new Date();
  const earliest = items.reduce((m, it) => Math.min(m, it.date), Infinity);
  const d = new Date(earliest);
  return Math.min(36, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) + 1);
}
