import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Search, UserCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { getAllBalances } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Parties — BahiBook" }] }),
  component: CustomersList,
});

function CustomersList() {
  const { format } = useCurrency();
  const [tab, setTab] = useState<"all" | "customer" | "supplier">("all");
  const [q, setQ] = useState("");
  const balances = useLiveQuery(() => getAllBalances(), []);

  const filtered = useMemo(() => {
    if (!balances) return [];
    return balances
      .filter(b => tab === "all" ? true : b.party.type === tab)
      .filter(b => !q || b.party.name.toLowerCase().includes(q.toLowerCase()) || b.party.phone?.includes(q));
  }, [balances, tab, q]);

  const totalGet = (balances || []).filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const totalGive = (balances || []).filter(b => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0);

  return (
    <AppShell>
      <PageHeader title="Parties" subtitle="Customers & suppliers" />

      <div className="space-y-3 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Card className="rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">You'll get</p>
            <p className="text-base font-bold tabular text-[color:var(--credit)]">{format(totalGet)}</p>
          </Card>
          <Card className="rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">You'll give</p>
            <p className="text-base font-bold tabular text-[color:var(--debit)]">{format(totalGive)}</p>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or phone" className="h-11 rounded-xl pl-9" />
        </div>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="customer">Customers</TabsTrigger>
            <TabsTrigger value="supplier">Suppliers</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ul className="mt-3 space-y-2 px-4">
        <AnimatePresence initial={false}>
          {filtered.map(({ party, balance }) => (
            <motion.li
              key={party.id}
              layout
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              <Link to="/customers/$id" params={{ id: String(party.id) }}>
                <Card className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-accent/30">
                  <Avatar name={party.name} photo={party.photo} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{party.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {party.phone || (party.type === "customer" ? "Customer" : "Supplier")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-bold tabular",
                      balance > 0 ? "text-[color:var(--credit)]" : balance < 0 ? "text-[color:var(--debit)]" : "text-muted-foreground"
                    )}>{format(balance)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {balance > 0 ? "to get" : balance < 0 ? "to give" : "settled"}
                    </p>
                  </div>
                </Card>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <UserCircle2 className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No parties yet</p>
            <p className="text-xs text-muted-foreground">Tap + to add your first customer or supplier.</p>
          </Card>
        )}
      </ul>

      <Link
        to="/customers/new"
        className="fixed bottom-24 right-[max(1rem,calc(50%-13rem))] z-40 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-elevated)]"
        style={{ background: "var(--gradient-primary)" }}
        aria-label="Add party"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </AppShell>
  );
}

export function Avatar({ name, photo, size = 40 }: { name: string; photo?: string; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("");
  if (photo) return <img src={photo} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
      style={{ width: size, height: size }}
    >{initials || "?"}</div>
  );
}
