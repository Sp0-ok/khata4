import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft, Download, Moon, Sun, Trash2, Upload, Monitor, Building2,
  Coins, Search, Hash, Image as ImageIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db, getSettings, updateSettings, ALL_CURRENCIES } from "@/lib/db";
import { downscaleImage } from "@/lib/image";
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

function downloadFile(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}


function SettingsPage() {
  const settings = useLiveQuery(() => getSettings(), []);
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [curQ, setCurQ] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Image too large (max 2MB)"); e.target.value = ""; return; }
    try {
      const dataUrl = await downscaleImage(f, 256);
      await updateSettings({ logo: dataUrl });
      toast.success("Logo updated");
    } catch (err: any) {
      toast.error(err.message || "Could not load image");
    } finally { e.target.value = ""; }
  };

  const filteredCurrencies = useMemo(() => {
    const q = curQ.trim().toLowerCase();
    if (!q) return ALL_CURRENCIES;
    return ALL_CURRENCIES.filter(c =>
      c.c.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.s.toLowerCase().includes(q),
    );
  }, [curQ]);

  if (!settings) return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;

  const onExportJSON = async () => {
    try {
      const data = {
        version: 2,
        app: "Hisaab Kitaab",
        exportedAt: new Date().toISOString(),
        settings: await db.settings.toArray(),
        parties: await db.parties.toArray(),
        transactions: await db.transactions.toArray(),
        invoices: await db.invoices.toArray(),
        expenses: await db.expenses.toArray(),
      };
      downloadFile(
        `hisaab-kitaab-backup-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json",
        JSON.stringify(data, null, 2),
      );
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

      // Map old party IDs → newly inserted IDs so dependent records still link correctly.
      const idMap = new Map<number, number>();

      await db.transaction("rw", [db.parties, db.transactions, db.invoices, db.expenses, db.settings], async () => {
        await db.parties.clear();
        await db.transactions.clear();
        await db.invoices.clear();
        await db.expenses.clear();

        // Re-insert parties one by one to capture new IDs.
        for (const p of data.parties) {
          const { id: oldId, ...rest } = p;
          const newId = await db.parties.add(rest);
          if (oldId != null) idMap.set(Number(oldId), newId);
        }

        const remappedTxns = data.transactions
          .map((t: any) => {
            const { id, partyId, ...rest } = t;
            const mapped = idMap.get(Number(partyId));
            if (mapped == null) return null;
            return { ...rest, partyId: mapped };
          })
          .filter(Boolean);
        if (remappedTxns.length) await db.transactions.bulkAdd(remappedTxns);

        if (Array.isArray(data.invoices)) {
          const remappedInvs = data.invoices.map((i: any) => {
            const { id, partyId, ...rest } = i;
            return { ...rest, partyId: partyId != null ? idMap.get(Number(partyId)) : undefined };
          });
          if (remappedInvs.length) await db.invoices.bulkAdd(remappedInvs);
        }
        if (Array.isArray(data.expenses)) {
          await db.expenses.bulkAdd(data.expenses.map((x: any) => { const { id, ...r } = x; return r; }));
        }
        // Restore settings (single row).
        if (Array.isArray(data.settings) && data.settings[0]) {
          const cur = await db.settings.toArray();
          const { id: _sid, ...patch } = data.settings[0];
          if (cur[0]) await db.settings.update(cur[0].id!, patch);
          else await db.settings.add(patch);
        }
      });
      toast.success(
        `Restored ${data.parties.length} parties, ${data.transactions.length} txns, ` +
        `${data.invoices?.length || 0} invoices, ${data.expenses?.length || 0} expenses`,
      );
    } catch (err: any) {
      toast.error(err.message || "Invalid backup file");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const onWipe = async () => {
    await db.transaction("rw", db.parties, db.transactions, db.invoices, db.expenses, async () => {
      await db.parties.clear();
      await db.transactions.clear();
      await db.invoices.clear();
      await db.expenses.clear();
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

          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => logoRef.current?.click()}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> {settings.logo ? "Replace logo" : "Upload logo"}
              </Button>
              {settings.logo && (
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                  onClick={() => updateSettings({ logo: undefined })}>
                  <X className="mr-1 h-3 w-3" /> Remove
                </Button>
              )}
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Business name</Label>
            <Input defaultValue={settings.businessName}
              onBlur={e => updateSettings({ businessName: e.target.value || "My Business" })}
              maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Owner name</Label>
            <Input defaultValue={settings.ownerName || ""}
              onBlur={e => updateSettings({ ownerName: e.target.value })} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input defaultValue={settings.phone || ""}
              onBlur={e => updateSettings({ phone: e.target.value })} inputMode="tel" maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Address (shown on invoices)</Label>
            <Input defaultValue={settings.address || ""}
              onBlur={e => updateSettings({ address: e.target.value })} maxLength={200} />
          </div>
        </Card>

        <Card className="space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Hash className="h-4 w-4 text-primary" /> Invoicing</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice prefix</Label>
              <Input defaultValue={settings.invoicePrefix || "INV-"}
                onBlur={e => updateSettings({ invoicePrefix: e.target.value || "INV-" })} maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default tax %</Label>
              <Input type="number" inputMode="decimal" step="0.01" min="0"
                defaultValue={settings.taxPercent || 0}
                onBlur={e => updateSettings({ taxPercent: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            <span>Show "Generated by Hisaab Kitaab" on invoices</span>
            <input type="checkbox" className="h-4 w-4 accent-primary"
              checked={settings.invoiceWatermark !== false}
              onChange={e => updateSettings({ invoiceWatermark: e.target.checked })} />
          </label>
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
                  settings.currency === c ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
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
                  theme === val ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
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
          <Button variant="outline" className="h-11 w-full justify-start rounded-xl" onClick={onExportJSON}>
            <Download className="mr-2 h-4 w-4" /> Full backup (JSON)
          </Button>
          <label className="block">
            <span className={cn(
              "flex h-11 w-full cursor-pointer items-center rounded-xl border border-input bg-background px-4 text-sm font-medium hover:bg-accent",
              busy && "pointer-events-none opacity-50",
            )}>
              <Upload className="mr-2 h-4 w-4" /> {busy ? "Importing…" : "Restore backup"}
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
                  Deletes all parties, transactions, invoices and expenses on this device. Export a backup first.
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

