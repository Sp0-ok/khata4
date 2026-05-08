import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettings, ONBOARDING_CURRENCIES } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Hisaab Kitaab" }] }),
  component: Onboarding,
});

const slides = [
  { icon: BookOpen, title: "Your Digital Khata", body: "Track parties, balances and payments in seconds. Replace paper ledgers forever." },
  { icon: Wallet, title: "Know who owes what", body: "Crystal-clear receivables and payables. Never lose track of a payment again." },
  { icon: ShieldCheck, title: "100% private & offline", body: "Your data lives on your device. No ads, no subscriptions, no cloud lock-in." },
];

function Onboarding() {
  const [step, setStep] = useState(0);
  const [biz, setBiz] = useState("");
  const [cur, setCur] = useState(ONBOARDING_CURRENCIES[0]);
  const navigate = useNavigate();

  const finish = async () => {
    await updateSettings({
      businessName: biz.trim() || "My Business",
      currency: cur.c, currencySymbol: cur.s,
      onboarded: true,
    });
    navigate({ to: "/" });
  };

  return (
    <AppShell hideNav>
      <div className="flex min-h-screen flex-col px-6 pb-8 pt-12">
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-8 bg-primary" : "w-4 bg-muted")} />
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {step < 3 ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div
                  className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl text-primary-foreground shadow-[var(--shadow-elevated)]"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {(() => { const I = slides[step].icon; return <I className="h-11 w-11" />; })()}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Hisaab Kitaab</p>
                  <h1 className="mt-1 text-2xl font-bold">{slides[step].title}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">{slides[step].body}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-5 text-left"
              >
                <div className="space-y-1 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-primary" />
                  <h1 className="text-2xl font-bold">Set up your business</h1>
                  <p className="text-sm text-muted-foreground">More currencies available later in Settings.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Business name</Label>
                  <Input value={biz} onChange={e => setBiz(e.target.value)} placeholder="e.g. Ali General Store" maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ONBOARDING_CURRENCIES.map(c => (
                      <button
                        key={c.c} type="button" onClick={() => setCur(c)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors",
                          cur.c === c.c ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                        )}
                      >
                        <span className="block text-xs text-muted-foreground">{c.s} · {c.name}</span>
                        {c.c}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-2 safe-bottom">
          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)} className="h-12 w-full text-base font-semibold">
              {step === 2 ? "Get started" : "Next"} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} className="h-12 w-full text-base font-semibold">
              Open my khata
            </Button>
          )}
          {step < 3 && (
            <button onClick={finish} className="block w-full py-2 text-xs font-medium text-muted-foreground">
              Skip
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
