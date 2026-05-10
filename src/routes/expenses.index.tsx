import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { db, EXPENSE_CATEGORIES } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expenses/")({
  head: () => ({ meta: [{ title: "Expenses — Hisaab Kitaab" }] }),
  component: ExpensesList,
});

function ExpensesList() {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingEdit, setPendingEdit] = useState<number | null>(null);
  const expenses = useLiveQuery(
    () => db.expenses.toArray().then(arr => arr.sort((a, b) => b.createdAt - a.createdAt)),
    [],
  );

  const filtered = useMemo(() => {
    if (!expenses) return [];
    return expenses
      .filter(e => cat === "all" || e.category === cat)
      .filter(e => !q ||
        e.title.toLowerCase().includes(q.toLowerCase()) ||
        (e.vendor || "").toLowerCase().includes(q.toLowerCase()),
      );
  }, [expenses, cat, q]);

  const monthStart = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime();
  }, []);
  const totalMonth = (expenses || []).filter(e => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);
  const totalAll = (expenses || []).reduce((s, e) => s + e.amount, 0);

  const onDelete = async (id: number) => {
    await db.expenses.delete(id);
    toast.success("Expense deleted");
    setPendingDelete(null);
  };

  return (
    <AppShell>
      <PageHeader title="Expenses" subtitle="Track every business expense" />

      <div className="space-y-3 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Card className="rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">This month</p>
            <p className="text-base font-bold tabular text-[color:var(--debit)]">{format(totalMonth)}</p>
          </Card>
          <Card className="rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">All time</p>
            <p className="text-base font-bold tabular">{format(totalAll)}</p>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search expenses" className="h-11 rounded-xl pl-9" />
        </div>

        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <ul className="mt-3 space-y-2 px-4">
        <AnimatePresence initial={false}>
          {filtered.map(e => (
            <motion.li key={e.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="flex items-center gap-3 rounded-2xl p-3">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  "bg-[color:var(--debit)]/15 text-[color:var(--debit)]",
                )}>
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">{e.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {e.category} · {new Date(e.date).toLocaleDateString()}{e.vendor ? ` · ${e.vendor}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular text-[color:var(--debit)]">{format(e.amount)}</p>
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <button aria-label="Edit"
                      onClick={() => navigate({ to: "/expenses/new", search: { id: e.id! } })}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label="Delete"
                      onClick={() => onDelete(e.id!)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No expenses yet</p>
            <p className="text-xs text-muted-foreground">Tap + to log your first expense.</p>
          </Card>
        )}
      </ul>

      <Link
        to="/expenses/new"
        className="fixed bottom-24 right-[max(1rem,calc(50%-13rem))] z-40 flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-[var(--shadow-elevated)]"
        style={{ background: "var(--gradient-primary)" }}
        aria-label="New expense"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </AppShell>
  );
}
