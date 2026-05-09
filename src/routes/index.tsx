import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft, ArrowUpRight, FileText, Heart, Receipt, Settings as SettingsIcon,
  TrendingUp, Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db, getAllBalances } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { PartyPickerSheet } from "@/components/PartyPickerSheet";
import { haptic, tapLight } from "@/lib/haptics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hisaab Kitaab — Dashboard" },
      { name: "description", content: "Your business at a glance: receivables and payables." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { format, settings } = useCurrency();
  const navigate = useNavigate();
  const balances = useLiveQuery(() => getAllBalances(), []);
  const recent = useLiveQuery(
    () => db.transactions.orderBy("createdAt").reverse().limit(8).toArray(), [],
  );
  const parties = useLiveQuery(() => db.parties.toArray(), []);

  useEffect(() => {
    if (settings && !settings.onboarded) navigate({ to: "/onboarding" });
  }, [settings, navigate]);

  const receivable = (balances || []).filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const payable = (balances || []).filter(b => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0);
  const net = receivable - payable;

  const [eggOpen, setEggOpen] = useState(false);
  const [eggReady, setEggReady] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const holdFired = useRef(false);

  const startHold = () => {
    holdFired.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdFired.current = true;
      haptic([20, 40, 80]);
      setEggOpen(true);
      // Defer enabling the close-on-tap handler so the same pointer-up
      // that just released the long-press doesn't immediately close it.
      setEggReady(false);
      window.setTimeout(() => setEggReady(true), 450);
    }, 5000);
  };
  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };
  const closeEgg = () => { if (eggReady) setEggOpen(false); };

  return (
    <AppShell>
      <header className="flex items-start justify-between px-5 pt-7 pb-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Hisaab Kitaab</p>
          <h1 className="truncate text-2xl font-bold">{settings?.businessName || "My Business"}</h1>
        </div>
        <Link
          to="/settings"
          aria-label="Settings"
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          onTouchMove={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => { if (holdFired.current) { e.preventDefault(); holdFired.current = false; } else { tapLight(); } }}
          style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", touchAction: "manipulation" }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground select-none"
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>
      </header>

      <AnimatePresence>
        {eggOpen && (
          <motion.div
            key="egg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
            onClick={closeEgg}
          >
            <motion.div
              initial={{ scale: 0.6, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="rounded-3xl px-8 py-7 text-center text-white shadow-[var(--shadow-elevated)]"
              style={{ background: "var(--gradient-primary)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto mb-3 inline-block"
              >
                <Heart className="h-10 w-10 fill-white text-white drop-shadow" />
              </motion.div>
              <p className="text-sm uppercase tracking-[0.25em] opacity-90">Made with love</p>
              <p className="mt-1 text-2xl font-bold">by Sp0_ok</p>
              <p className="mt-3 text-[11px] opacity-75">Tap anywhere to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-[var(--shadow-elevated)]"
          style={{
            background: net < 0
              ? "linear-gradient(135deg, var(--debit), oklch(0.5 0.18 25))"
              : "var(--gradient-primary)",
          }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-2 text-xs opacity-90">
            <Wallet className="h-3.5 w-3.5" /> Net Balance · Parties
          </div>
          <div className="mt-1 text-3xl font-bold tabular">
            {net < 0 ? "− " : ""}{format(Math.abs(net))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="You'll get" value={format(receivable)} icon={<ArrowDownLeft className="h-4 w-4" />} />
            <Stat label="You'll give" value={format(payable)} icon={<ArrowUpRight className="h-4 w-4" />} />
          </div>
        </motion.div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-4 pt-4">
        <PartyPickerSheet
          title="Record what you gave (You'll get)"
          txnType="debit"
          trigger={
            <button className="text-left">
              <QuickCard
                tone="credit"
                icon={<ArrowDownLeft className="h-5 w-5" />}
                label="You'll Get"
                sub="Pick a party"
              />
            </button>
          }
        />
        <PartyPickerSheet
          title="Record a payment (You'll give)"
          txnType="credit"
          trigger={
            <button className="text-left">
              <QuickCard
                tone="debit"
                icon={<ArrowUpRight className="h-5 w-5" />}
                label="You'll Give"
                sub="Pick a party"
              />
            </button>
          }
        />
        <Link to="/invoices/new">
          <QuickCard tone="credit" icon={<FileText className="h-5 w-5" />} label="New Invoice" sub="Bill a party" />
        </Link>
        <Link to="/expenses/new">
          <QuickCard tone="debit" icon={<Receipt className="h-5 w-5" />} label="Add Expense" sub="Log a spend" />
        </Link>
      </section>

      <section className="px-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent activity</h2>
          <Link to="/customers" className="text-xs font-medium text-primary">View all</Link>
        </div>
        <div className="mt-3 space-y-2">
          {recent && recent.length === 0 && (
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-accent p-3"><TrendingUp className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="font-semibold">Start your first khata</p>
                <p className="text-xs text-muted-foreground">Add a party and record transactions.</p>
              </div>
              <Button asChild size="sm"><Link to="/customers/new">Add party</Link></Button>
            </Card>
          )}
          {recent?.map(t => {
            const party = parties?.find(p => p.id === t.partyId);
            return (
              <Link key={t.id} to="/customers/$id" params={{ id: String(t.partyId) }}>
                <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/30">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    t.type === "credit" ? "bg-[color:var(--credit)]/15 text-[color:var(--credit)]" : "bg-[color:var(--debit)]/15 text-[color:var(--debit)]"
                  )}>
                    {t.type === "credit" ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{party?.name || "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.note || (t.type === "credit" ? "Received" : "Given")}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold tabular", t.type === "credit" ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]")}>
                      {format(t.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[11px] opacity-90">{icon}{label}</div>
      <div className="mt-1 text-base font-semibold tabular">{value}</div>
    </div>
  );
}

function QuickCard({
  icon, label, sub, tone,
}: { icon: React.ReactNode; label: string; sub: string; tone: "credit" | "debit" }) {
  return (
    <Card className={cn(
      "flex w-full items-center gap-3 rounded-2xl p-3 transition-transform active:scale-[0.98]",
      tone === "credit" ? "border-[color:var(--credit)]/30" : "border-[color:var(--debit)]/30",
    )}>
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full",
        tone === "credit" ? "bg-[color:var(--credit)]/15 text-[color:var(--credit)]" : "bg-[color:var(--debit)]/15 text-[color:var(--debit)]",
      )}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </Card>
  );
}
