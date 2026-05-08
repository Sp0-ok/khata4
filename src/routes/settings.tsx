import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Download, Moon, Sun, Trash2, Upload, Monitor, Building2, Coins } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db, getSettings, updateSettings } from "@/lib/db";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — BahiBook" }] }),
  component: SettingsPage,
});

const currencies = [
  { c: "PKR", s: "Rs" }, { c: "INR", s: "₹" }, { c: "BDT", s: "৳" },
  { c: "USD", s: "$" }, { c: "AED", s: "د.إ" }, { c: "SAR", s: "﷼" },
];

function SettingsPage() {
  const settings = useLiveQuery(() => getSettings(), []);
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);

  if (!settings) return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;

  const onExport = async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: await db.settings.toArray(),
      parties: await db.parties.toArray(),
      transactions: await db.transactions.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bahibook-backup-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.parties) || !Array.isArray(data.transactions)) throw new Error("Invalid file");
      await db.transaction("rw", db.parties, db.transactions, async () => {
        await db.parties.clear();
        await db.transactions.clear();
        await db.parties.bulkAdd(data.parties);
        await db.transactions.bulkAdd(data.transactions);
      });
      toast.success("Backup restored");
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
      <PageHeader title="Settings" />

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
          <div className="flex items-center gap-2 text-sm font-semibold"><Coins className="h-4 w-4 text-primary" /> Currency</div>
          <div className="grid grid-cols-3 gap-2">
            {currencies.map(({ c, s }) => (
              <button
                key={c}
                onClick={() => updateSettings({ currency: c, currencySymbol: s })}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  settings.currency === c ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                )}
              >
                <span className="block text-xs text-muted-foreground">{s}</span>
                {c}
              </button>
            ))}
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
          <div className="text-sm font-semibold">Backup & data</div>
          <Button variant="outline" className="h-11 w-full justify-start rounded-xl" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" /> Export backup (JSON)
          </Button>
          <label className="block">
            <Button variant="outline" asChild className="h-11 w-full justify-start rounded-xl pointer-events-none">
              <span><Upload className="mr-2 h-4 w-4" /> {busy ? "Importing…" : "Import backup"}</span>
            </Button>
            <input type="file" accept="application/json" hidden onChange={onImport} />
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
          BahiBook · 100% offline · No ads · No tracking
        </p>
      </div>
    </AppShell>
  );
}
