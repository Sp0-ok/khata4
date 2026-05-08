import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { ChevronLeft, Download, Moon, Sun, Trash2, Upload, Monitor, Building2, Coins, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db, getSettings, updateSettings, ALL_CURRENCIES } from "@/lib/db";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Hisaab Kitaab" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useLiveQuery(() => getSettings(), []);
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [curQ, setCurQ] = useState("");

  const filteredCurrencies = useMemo(() => {
    const q = curQ.trim().toLowerCase();
    if (!q) return ALL_CURRENCIES;
    return ALL_CURRENCIES.filter(c =>
      c.c.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.s.toLowerCase().includes(q)
    );
  }, [curQ]);

  if (!settings) return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;

  const onExport = async () => {
    try {
      const data = {
        version: 1,
        app: "Hisaab Kitaab",
        exportedAt: new Date().toISOString(),
        settings: await db.settings.toArray(),
        parties: await db.parties.toArray(),
        transactions: await db.transactions.toArray(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `hisaab-kitaab-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.parties) || !Array.isArray(data.transactions)) throw new Error("Invalid backup file");
      await db.transaction("rw", db.parties, db.transactions, async () => {
        await db.parties.clear();
        await db.transactions.clear();
        // strip ids to avoid collisions
        await db.parties.bulkAdd(data.parties.map((p: any) => { const { id, ...r } = p; return r; }));
        await db.transactions.bulkAdd(data.transactions.map((t: any) => { const { id, ...r } = t; return r; }));
      });
      toast.success(`Restored ${data.parties.length} parties, ${data.transactions.length} transactions`);
    } catch (err: any) {
      toast.error(err.message || "Invalid backup file");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const onWipe = async () => {
    await db.transaction("rw", db.parties, db.transactions, async () => {
      await db.parties.clear();
      await db.transactions.clear();
    });
    toast.success("All data cleared");
  };

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        back={<Link to="/" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
      />

      <div className="space-y-4 px-4 pt-4">
        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary" /> Business</div>
          <div className="space-y-1.5">
            <Label className="text-xs">Business name</Label>
            <Input defaultValue={settings.businessName}
              onBlur={e => updateSettings({ businessName: e.target.value || "My Business" })}
              maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Owner name</Label>
            <Input defaultValue={settings.ownerName || ""}
              onBlur={e => updateSettings({ ownerName: e.target.value })}
              maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input defaultValue={settings.phone || ""}
              onBlur={e => updateSettings({ phone: e.target.value })}
              inputMode="tel" maxLength={20} />
          </div>
        </Card>

        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="h-4 w-4 text-primary" /> Currency
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {settings.currency}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={curQ} onChange={e => setCurQ(e.target.value)} placeholder="Search currencies" className="h-10 rounded-xl pl-9" />
          </div>
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {filteredCurrencies.map(({ c, s, name }) => (
              <button
                key={c}
                onClick={() => updateSettings({ currency: c, currencySymbol: s })}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors",
                  settings.currency === c ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                )}
              >
                <span className="block truncate text-[10px] text-muted-foreground">{s} · {name}</span>
                {c}
              </button>
            ))}
            {filteredCurrencies.length === 0 && (
              <p className="col-span-2 py-3 text-center text-xs text-muted-foreground">No matches</p>
            )}
          </div>
        </Card>

        <Card className="space-y-3 rounded-2xl p-4">
          <div className="text-sm font-semibold">Appearance</div>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "Auto", Monitor],
            ] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                onClick={() => setTheme(val)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors",
                  theme === val ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 rounded-2xl p-4">
          <div className="text-sm font-semibold">Backup &amp; data</div>
          <Button variant="outline" className="h-11 w-full justify-start rounded-xl" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" /> Export backup (JSON)
          </Button>
          <label className="block">
            <span className={cn(
              "flex h-11 w-full cursor-pointer items-center rounded-xl border border-input bg-background px-4 text-sm font-medium hover:bg-accent",
              busy && "pointer-events-none opacity-50"
            )}>
              <Upload className="mr-2 h-4 w-4" /> {busy ? "Importing…" : "Import backup"}
            </span>
            <input type="file" accept="application/json,.json" hidden onChange={onImport} disabled={busy} />
          </label>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="h-11 w-full justify-start rounded-xl text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Clear all data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Erase everything?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes all parties and transactions from this device. Export a backup first if you want to keep them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onWipe}>Erase</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>

        <p className="pb-4 text-center text-[11px] text-muted-foreground">
          Hisaab Kitaab · Digital Khata · 100% offline · No ads · No tracking
        </p>
      </div>
    </AppShell>
  );
}
