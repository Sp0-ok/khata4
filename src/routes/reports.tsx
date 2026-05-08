import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { db, getAllBalances } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Hisaab Kitaab" }] }),
  component: Reports,
});

function Reports() {
  const { format, symbol } = useCurrency();
  const balances = useLiveQuery(() => getAllBalances(), []);
  const txns = useLiveQuery(() => db.transactions.toArray(), []);

  const totals = useMemo(() => {
    const t = txns || [];
    return {
      received: t.filter(x => x.type === "credit").reduce((s, x) => s + x.amount, 0),
      given: t.filter(x => x.type === "debit").reduce((s, x) => s + x.amount, 0),
    };
  }, [txns]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: { name: string; received: number; given: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ name: d.toLocaleDateString(undefined, { month: "short" }), received: 0, given: 0 });
    }
    (txns || []).forEach(t => {
      const d = new Date(t.date);
      const idx = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      const i = 5 - idx;
      if (i >= 0 && i < 6) {
        if (t.type === "credit") buckets[i].received += t.amount;
        else buckets[i].given += t.amount;
      }
    });
    return buckets;
  }, [txns]);

  const top = useMemo(() => {
    return [...(balances || [])]
      .filter(b => b.balance !== 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 5);
  }, [balances]);

  return (
    <AppShell>
      <PageHeader title="Reports" subtitle="Insights from your khata" />

      <section className="grid grid-cols-2 gap-3 px-4 pt-4">
        <Card className="rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Total received</p>
          <p className="mt-1 text-xl font-bold tabular text-[color:var(--credit)]">{format(totals.received)}</p>
        </Card>
        <Card className="rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Total given</p>
          <p className="mt-1 text-xl font-bold tabular text-[color:var(--debit)]">{format(totals.given)}</p>
        </Card>
      </section>

      <section className="px-4 pt-4">
        <Card className="rounded-2xl p-4">
          <h3 className="text-sm font-semibold">Last 6 months</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barSize={14}>
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
                <Bar dataKey="received" fill="var(--credit)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="given" fill="var(--debit)" radius={[6, 6, 0, 0]} />
              </BarChart>
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
    </AppShell>
  );
}
