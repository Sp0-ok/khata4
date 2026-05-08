import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, getAllBalances, calcInvoiceTotals, EXPENSE_CATEGORIES } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from "recharts";
import { BarChart3, LineChart as LineIcon } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Hisaab Kitaab" }] }),
  component: Reports,
});

const PIE_COLORS = [
  "oklch(0.55 0.13 170)", "oklch(0.6 0.21 25)", "oklch(0.78 0.16 75)",
  "oklch(0.62 0.15 220)", "oklch(0.7 0.15 300)", "oklch(0.65 0.18 50)",
  "oklch(0.6 0.14 120)", "oklch(0.55 0.16 350)", "oklch(0.7 0.1 200)",
  "oklch(0.5 0.18 270)", "oklch(0.6 0.12 100)",
];

type Period = "1m" | "3m" | "6m" | "12m" | "all";
const PERIOD_MONTHS: Record<Period, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12, all: 0 };
const PERIOD_LABEL: Record<Period, string> = { "1m": "1M", "3m": "3M", "6m": "6M", "12m": "1Y", all: "All" };

function Reports() {
  const { format, symbol } = useCurrency();
  const [view, setView] = useState<"parties" | "business">("parties");
  const [chartKind, setChartKind] = useState<"bars" | "lines">("bars");
  const [period, setPeriod] = useState<Period>("6m");

  const balances = useLiveQuery(() => getAllBalances(), []);
  const txns = useLiveQuery(() => db.transactions.toArray(), []);
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const expenses = useLiveQuery(() => db.expenses.toArray(), []);

  const cutoffTs = useMemo(() => {
    if (period === "all") return 0;
    const d = new Date();
    d.setMonth(d.getMonth() - (PERIOD_MONTHS[period] - 1));
    d.setDate(1); d.setHours(0, 0, 0, 0);
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

  const monthlyParties = useMemo(() => buildBuckets(fTxns, period,
    (it, b) => { if (it.type === "credit") b.received += it.amount; else b.given += it.amount; },
    { received: 0, given: 0 }
  ), [fTxns, period]);

  const monthlyBiz = useMemo(() => buildBuckets(
    [...fInvoices.map(i => ({ date: i.date, _kind: "inv", amount: calcInvoiceTotals(i).total })),
     ...fExpenses.map(e => ({ date: e.date, _kind: "exp", amount: e.amount }))],
    period,
    (it, b) => { if (it._kind === "inv") b.sales += it.amount; else b.expenses += it.amount; },
    { sales: 0, expenses: 0 }
  ), [fInvoices, fExpenses, period]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    EXPENSE_CATEGORIES.forEach(c => map.set(c, 0));
    fExpenses.forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries()).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fExpenses]);

  const top = useMemo(() => [...(balances || [])]
    .filter(b => b.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 5), [balances]);

  const tooltipStyle = {
    background: "var(--popover)", border: "1px solid var(--border)",
    borderRadius: 12, fontSize: 12, color: "var(--foreground)",
  };
  const fmt = (v: number) => `${symbol} ${v.toLocaleString()}`;
  const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const tickFmt = (v: number) => compact.format(v);

  const periodLabel = period === "all" ? "All time" : `Last ${PERIOD_LABEL[period]}`;

  return (
    <AppShell>
      <PageHeader title="Reports" subtitle={view === "parties" ? "Receivables & payables" : "Invoices & expenses"} />

      <div className="space-y-3 px-4 pt-4">
        <Tabs value={view} onValueChange={v => setView(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parties">Parties</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        <Tabs value={chartKind} onValueChange={v => setChartKind(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bars"><BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Bars</TabsTrigger>
            <TabsTrigger value="lines"><LineIcon className="mr-1.5 h-3.5 w-3.5" /> Lines</TabsTrigger>
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
            <Card className="rounded-2xl p-4">
              <h3 className="text-sm font-semibold">{periodLabel} · Parties</h3>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  {chartKind === "bars" ? (
                    <BarChart data={monthlyParties} barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} width={56} tickFormatter={tickFmt} />
                      <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar name="Received" dataKey="received" fill="var(--credit)" radius={[6, 6, 0, 0]} />
                      <Bar name="Given" dataKey="given" fill="var(--debit)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={monthlyParties}>
                      <defs>
                        <linearGradient id="gReceived" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--credit)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--credit)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gGiven" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--debit)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="var(--debit)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} width={56} tickFormatter={tickFmt} />
                      <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" name="Received" dataKey="received" stroke="var(--credit)" strokeWidth={2.5} fill="url(#gReceived)" />
                      <Area type="monotone" name="Given" dataKey="given" stroke="var(--debit)" strokeWidth={2.5} fill="url(#gGiven)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
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
                      <p className="text-[11px] text-muted-foreground capitalize">{party.type}</p>
                    </div>
                    <p className={`text-sm font-bold tabular ${balance > 0 ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]"}`}>
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
            <Card className="rounded-2xl p-4">
              <h3 className="text-sm font-semibold">{periodLabel} · Business</h3>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  {chartKind === "bars" ? (
                    <BarChart data={monthlyBiz} barSize={12}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} width={56} tickFormatter={tickFmt} />
                      <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar name="Sales" dataKey="sales" fill="var(--credit)" radius={[6, 6, 0, 0]} />
                      <Bar name="Expenses" dataKey="expenses" fill="var(--debit)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={monthlyBiz}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={10} width={56} tickFormatter={tickFmt} />
                      <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" name="Sales" dataKey="sales" stroke="var(--credit)" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" name="Expenses" dataKey="expenses" stroke="var(--debit)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          {expenseByCategory.length > 0 && (
            <section className="px-4 pt-4">
              <Card className="rounded-2xl p-4">
                <h3 className="text-sm font-semibold">Expenses by category</h3>
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {expenseByCategory.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={fmt} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

function buildBuckets<T extends { date: number }, B extends Record<string, number>>(
  items: T[], period: Period, add: (it: T, b: B) => void, init: B,
): (B & { name: string })[] {
  const now = new Date();
  const months = PERIOD_MONTHS[period];

  if (period === "1m") {
    // Daily buckets for current month
    const days = now.getDate();
    const buckets: (B & { name: string })[] = [];
    for (let d = 1; d <= days; d++) {
      buckets.push({ ...init, name: String(d) } as B & { name: string });
    }
    items.forEach(it => {
      const dt = new Date(it.date);
      if (dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()) {
        const idx = dt.getDate() - 1;
        if (idx >= 0 && idx < days) add(it, buckets[idx]);
      }
    });
    return buckets;
  }

  // Monthly buckets
  const count = period === "all" ? Math.max(1, monthsSpan(items)) : months;
  const buckets: (B & { name: string })[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = count > 12
      ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short" });
    buckets.push({ ...init, name: label } as B & { name: string });
  }
  const idxOf = (ts: number) => {
    const d = new Date(ts);
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    return count - 1 - diff;
  };
  items.forEach(it => {
    const k = idxOf(it.date);
    if (k >= 0 && k < count) add(it, buckets[k]);
  });
  return buckets;
}

function monthsSpan(items: { date: number }[]): number {
  if (!items.length) return 6;
  const now = new Date();
  const earliest = items.reduce((m, it) => Math.min(m, it.date), Infinity);
  const d = new Date(earliest);
  return Math.min(36, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) + 1);
}

function MiniCard({ label, value, tone }: { label: string; value: string; tone: "credit" | "debit" }) {
  return (
    <Card className="rounded-2xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`truncate text-sm font-bold tabular ${tone === "credit" ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]"}`}>
        {value}
      </p>
    </Card>
  );
}
