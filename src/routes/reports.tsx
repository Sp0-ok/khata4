import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { db, getAllBalances, calcInvoiceTotals, EXPENSE_CATEGORIES } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";

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

function Reports() {
  const { format, symbol } = useCurrency();
  const balances = useLiveQuery(() => getAllBalances(), []);
  const txns = useLiveQuery(() => db.transactions.toArray(), []);
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const expenses = useLiveQuery(() => db.expenses.toArray(), []);

  const totals = useMemo(() => {
    const t = txns || [];
    const sales = (invoices || []).reduce((s, i) => s + calcInvoiceTotals(i).total, 0);
    const exp = (expenses || []).reduce((s, e) => s + e.amount, 0);
    return {
      received: t.filter(x => x.type === "credit").reduce((s, x) => s + x.amount, 0),
      given: t.filter(x => x.type === "debit").reduce((s, x) => s + x.amount, 0),
      sales, expenses: exp, profit: sales - exp,
    };
  }, [txns, invoices, expenses]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: { name: string; sales: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ name: d.toLocaleDateString(undefined, { month: "short" }), sales: 0, expenses: 0 });
    }
    const idxOf = (ts: number) => {
      const d = new Date(ts);
      const idx = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      return 5 - idx;
    };
    (invoices || []).forEach(i => {
      const k = idxOf(i.date); if (k >= 0 && k < 6) buckets[k].sales += calcInvoiceTotals(i).total;
    });
    (expenses || []).forEach(e => {
      const k = idxOf(e.date); if (k >= 0 && k < 6) buckets[k].expenses += e.amount;
    });
    return buckets;
  }, [invoices, expenses]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    EXPENSE_CATEGORIES.forEach(c => map.set(c, 0));
    (expenses || []).forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries())
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const top = useMemo(() => {
    return [...(balances || [])]
      .filter(b => b.balance !== 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 5);
  }, [balances]);

  return (
    <AppShell>
      <PageHeader title="Reports" subtitle="Sales, expenses and profit" />

      <section className="grid grid-cols-3 gap-2 px-4 pt-4">
        <MiniCard label="Sales" value={format(totals.sales)} tone="credit" />
        <MiniCard label="Expenses" value={format(totals.expenses)} tone="debit" />
        <MiniCard label="Profit" value={format(totals.profit)} tone={totals.profit >= 0 ? "credit" : "debit"} />
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-3">
        <MiniCard label="Received" value={format(totals.received)} tone="credit" />
        <MiniCard label="Given" value={format(totals.given)} tone="debit" />
      </section>

      <section className="px-4 pt-4">
        <Card className="rounded-2xl p-4">
          <h3 className="text-sm font-semibold">Last 6 months</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)", border: "1px solid var(--border)",
                    borderRadius: 12, fontSize: 12,
                  }}
                  formatter={(v: number) => `${symbol} ${v.toLocaleString()}`}
                />
                <Bar dataKey="sales" fill="var(--credit)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="var(--debit)" radius={[6, 6, 0, 0]} />
              </BarChart>
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
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => `${symbol} ${v.toLocaleString()}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      )}

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
    </AppShell>
  );
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
