import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CloudUpload, Receipt, Sparkles,
  TrendingUp, Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettings, ONBOARDING_CURRENCIES } from "@/lib/db";
import { signInWithGoogle, markFirstRunSeen } from "@/lib/sync";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import appIcon from "@/assets/app-icon.png";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Hisaab Kitaab" }] }),
  component: Onboarding,
});

const TOTAL_STEPS = 4; // 0: welcome, 1: features, 2: cloud backup, 3: business setup

const features = [
  { icon: Receipt, title: "Track every payment", body: "Log credits and debits in seconds." },
  { icon: Users, title: "Manage your parties", body: "Customers and suppliers in one place." },
  { icon: TrendingUp, title: "Clear reports", body: "See receivables, payables and trends instantly." },
];

function Onboarding() {
  const [step, setStep] = useState(0);
  const [biz, setBiz] = useState("");
  const [cur, setCur] = useState(ONBOARDING_CURRENCIES[0]);
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();

  const next = () => setStep(s => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const finish = async () => {
    await updateSettings({
      businessName: biz.trim() || "My Business",
      currency: cur.c, currencySymbol: cur.s,
      onboarded: true,
    });
    markFirstRunSeen();
    navigate({ to: "/" });
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    const r = await signInWithGoogle();
    setSigningIn(false);
    if (r.error) {
      toast.error(r.error.message);
      return;
    }
    toast.success("Signed in — your data will sync to Drive");
    next();
  };

  const handleSwipe = (_: any, info: PanInfo) => {
    const threshold = 60;
    if (info.offset.x < -threshold) {
      // swipe left -> next, but block on cloud step (step 2) and business step (3)
      if (step < 2) next();
    } else if (info.offset.x > threshold) {
      back();
    }
  };

  return (
    <AppShell hideNav>
      <div className="flex min-h-screen flex-col px-6 pb-8 pt-12">
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-8 bg-primary" : "w-4 bg-muted",
              )}
            />
          ))}
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleSwipe}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              {step === 0 && (
                <div className="space-y-6 text-center">
                  <img
                    src={appIcon}
                    alt="Hisaab Kitaab"
                    className="mx-auto h-32 w-32 rounded-3xl shadow-[var(--shadow-elevated)]"
                  />
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Hisaab Kitaab</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Simple ledger, always with you
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-primary" />
                    <h1 className="mt-2 text-2xl font-bold">What you can do</h1>
                  </div>
                  <div className="space-y-3">
                    {features.map(f => {
                      const I = f.icon;
                      return (
                        <div key={f.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <I className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{f.title}</p>
                            <p className="text-sm text-muted-foreground">{f.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 text-center">
                  <div
                    className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl text-primary-foreground shadow-[var(--shadow-elevated)]"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <CloudUpload className="h-11 w-11" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">Never lose your data</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Sign in with Google to automatically back up your data to your own
                      Google Drive. Free, private, and only accessible by you.
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="w-full space-y-5 text-left">
                  <div className="space-y-1 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold">Set up your business</h1>
                    <p className="text-sm text-muted-foreground">
                      You can change these later in Settings.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Business name</Label>
                    <Input
                      value={biz}
                      onChange={e => setBiz(e.target.value)}
                      placeholder="e.g. Ali General Store"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Currency</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ONBOARDING_CURRENCIES.map(c => (
                        <button
                          key={c.c}
                          type="button"
                          onClick={() => setCur(c)}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors",
                            cur.c === c.c
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-accent",
                          )}
                        >
                          <span className="block text-xs text-muted-foreground">
                            {c.s} · {c.name}
                          </span>
                          {c.c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="space-y-2 safe-bottom">
          {step === 0 && (
            <Button onClick={next} className="h-12 w-full text-base font-semibold">
              Get Started <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}

          {step === 1 && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={back} className="h-12 px-4">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={next} className="h-12 flex-1 text-base font-semibold">
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <>
              <Button
                onClick={handleSignIn}
                disabled={signingIn}
                className="h-12 w-full text-base font-semibold"
              >
                {signingIn ? "Signing in…" : "Sign in with Google"}
              </Button>
              <button
                onClick={next}
                disabled={signingIn}
                className="block w-full py-2 text-xs font-medium text-muted-foreground"
              >
                Skip for now
              </button>
            </>
          )}

          {step === 3 && (
            <Button onClick={finish} className="h-12 w-full text-base font-semibold">
              Open my khata
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
