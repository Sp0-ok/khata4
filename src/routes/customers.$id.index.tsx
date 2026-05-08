import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, FileText, MessageCircle, MoreVertical,
  Phone, Trash2, Pencil, Upload, Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Avatar } from "./customers.index";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db, getPartyBalance, getSettings, type PaymentMethod, type TxnType } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { downloadStatement, shareWhatsApp } from "@/lib/pdf";
import { saveFile } from "@/lib/native-download";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/customers/$id/")({
  head: () => ({ meta: [{ title: "Khata — Hisaab Kitaab" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const pid = Number(id);
  const navigate = useNavigate();
  const { format, symbol } = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingEdit, setPendingEdit] = useState<number | null>(null);

  const party = useLiveQuery(() => db.parties.get(pid), [pid]);
  const txns = useLiveQuery(
    () => db.transactions.where("partyId").equals(pid).toArray()
      .then(arr => arr.sort((a, b) => b.createdAt - a.createdAt)),
    [pid]
  );
  const balance = useLiveQuery(() => getPartyBalance(pid), [pid, txns?.length]) || 0;

  if (party === undefined) return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!party) return <AppShell><div className="p-6">Party not found.</div></AppShell>;

  const onShareReminder = () => {
    const msg = balance > 0
      ? `Assalam-o-Alaikum ${party.name}, your pending balance is ${format(balance)}. Kindly clear at your convenience. — Sent via Hisaab Kitaab.`
      : balance < 0
      ? `Assalam-o-Alaikum ${party.name}, our pending balance with you is ${format(balance)}. Will settle soon. — Hisaab Kitaab`
      : `Assalam-o-Alaikum ${party.name}, your account is fully settled. Thank you!`;
    shareWhatsApp(party.phone, msg);
  };

  const onDownloadPDF = async () => {
    try {
      const settings = await getSettings();
      await downloadStatement(party, settings.businessName, symbol);
      toast.success("Statement downloaded");
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const onDeleteParty = async () => {
    await db.transaction("rw", db.parties, db.transactions, async () => {
      await db.transactions.where("partyId").equals(pid).delete();
      await db.parties.delete(pid);
    });
    toast.success("Party deleted");
    navigate({ to: "/customers" });
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const text = await f.text();
      let rows: any[] = [];
      if (f.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
      } else {
        // CSV: date,type,amount,method,note
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const header = lines.shift()?.toLowerCase().split(",").map(h => h.trim()) || [];
        rows = lines.map(line => {
          const cells = parseCSVLine(line);
          const obj: any = {};
          header.forEach((h, i) => obj[h] = cells[i]);
          return obj;
        });
      }
      const now = Date.now();
      const cleaned = rows.map((r, i) => {
        const t = String(r.type || "").toLowerCase();
        const type: TxnType = t === "credit" || t === "got" || t === "received" ? "credit" : "debit";
        const amount = parseFloat(r.amount);
        if (!amount || amount <= 0) throw new Error(`Row ${i + 1}: invalid amount`);
        return {
          partyId: pid, type, amount,
          note: r.note ? String(r.note) : undefined,
          method: ((["cash","bank","easypaisa","jazzcash","card","cheque","other"] as PaymentMethod[])
            .includes(String(r.method).toLowerCase() as PaymentMethod)
            ? String(r.method).toLowerCase() : "cash") as PaymentMethod,
          date: r.date ? new Date(r.date).getTime() : now,
          createdAt: now + i,
        };
      });
      await db.transactions.bulkAdd(cleaned);
      await db.parties.update(pid, { updatedAt: Date.now() });
      toast.success(`Imported ${cleaned.length} transactions`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      e.target.value = "";
    }
  };

  const onExportTxns = async () => {
    const list = (await db.transactions.where("partyId").equals(pid).toArray())
      .sort((a, b) => a.date - b.date);
    if (!list.length) return toast.info("No transactions to export");
    const headers = ["date", "type", "amount", "method", "note"];
    const csvLine = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(",")].concat(
      list.map(t => [
        new Date(t.date).toISOString().slice(0, 10),
        t.type, t.amount, t.method, t.note || "",
      ].map(csvLine).join(",")),
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    await saveFile(`${party!.name.replace(/\s+/g, "_")}_transactions.csv`, blob, "text/csv");
    toast.success(`Exported ${list.length} transactions`);
  };

  return (
    <AppShell hideNav>
      <PageHeader
        title={party.name}
        subtitle={party.phone || "Party"}
        back={<Link to="/customers" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full p-1 hover:bg-accent"><MoreVertical className="h-5 w-5" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate({ to: "/customers/$id/edit", params: { id } })}>
                <Pencil className="mr-2 h-4 w-4" /> Edit party
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownloadPDF}><FileText className="mr-2 h-4 w-4" /> Download statement</DropdownMenuItem>
              <DropdownMenuItem onClick={onShareReminder}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp reminder</DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Import transactions</DropdownMenuItem>
              <DropdownMenuItem onClick={onExportTxns}><Download className="mr-2 h-4 w-4" /> Export transactions</DropdownMenuItem>
              {party.phone && (
                <DropdownMenuItem asChild><a href={`tel:${party.phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a></DropdownMenuItem>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive" onSelect={e => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete party
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this party?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All transactions for {party.name} will be permanently removed. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDeleteParty}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <input ref={fileRef} type="file" accept=".csv,.json,application/json,text/csv" hidden onChange={onImport} />

      <section className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 text-primary-foreground shadow-[var(--shadow-elevated)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="flex items-center gap-3">
            <Avatar name={party.name} photo={party.photo} size={48} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm opacity-90">{party.phone || "No phone"}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-widest opacity-80">
              {balance > 0 ? "You'll get" : balance < 0 ? "You'll give" : "Settled"}
            </p>
            <p className="text-3xl font-bold tabular">{format(Math.abs(balance))}</p>
          </div>
        </motion.div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-3">
        <Button variant="outline" className="h-11 rounded-xl" onClick={onShareReminder}>
          <MessageCircle className="mr-2 h-4 w-4" /> Reminder
        </Button>
        <Button variant="outline" className="h-11 rounded-xl" onClick={onDownloadPDF}>
          <FileText className="mr-2 h-4 w-4" /> Statement
        </Button>
      </section>

      <section className="px-4 pt-5">
        <h2 className="text-sm font-semibold text-muted-foreground">Transactions</h2>
        <div className="mt-2 space-y-2">
          {!txns?.length && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No transactions yet. Add the first one below.
            </Card>
          )}
          <AnimatePresence initial={false}>
            {txns?.map(t => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              >
                <Card className="flex items-center gap-3 p-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    t.type === "credit" ? "bg-[color:var(--credit)]/15 text-[color:var(--credit)]" : "bg-[color:var(--debit)]/15 text-[color:var(--debit)]"
                  )}>
                    {t.type === "credit" ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{t.note || (t.type === "credit" ? "Received" : "Given")}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {new Date(t.date).toLocaleDateString()} · {t.method}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-bold tabular", t.type === "credit" ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]")}>
                      {format(t.amount)}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <button
                        aria-label="Edit"
                        onClick={() => setPendingEdit(t.id!)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      ><Pencil className="h-3.5 w-3.5" /></button>
                      <button
                        aria-label="Delete"
                        onClick={() => setPendingDelete(t.id!)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      ><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <AlertDialog open={pendingDelete !== null} onOpenChange={o => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (pendingDelete != null) {
                await db.transactions.delete(pendingDelete);
                toast.success("Transaction deleted");
              }
              setPendingDelete(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingEdit !== null} onOpenChange={o => !o && setPendingEdit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit this entry?</AlertDialogTitle>
            <AlertDialogDescription>You can change the amount, type, date or note.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const tid = pendingEdit;
              setPendingEdit(null);
              if (tid != null) navigate({ to: "/customers/$id/txn/$txnId", params: { id, txnId: String(tid) } });
            }}>Edit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="sticky bottom-0 mt-6 grid grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur safe-bottom">
        <Button
          className="h-12 text-base font-semibold"
          style={{ background: "var(--credit)", color: "white" }}
          onClick={() => navigate({ to: "/customers/$id/add", params: { id }, search: { type: "credit" } })}
        >
          <ArrowDownLeft className="mr-2 h-4 w-4" /> You got
        </Button>
        <Button
          className="h-12 text-base font-semibold"
          style={{ background: "var(--debit)", color: "white" }}
          onClick={() => navigate({ to: "/customers/$id/add", params: { id }, search: { type: "debit" } })}
        >
          <ArrowUpRight className="mr-2 h-4 w-4" /> You gave
        </Button>
      </div>
    </AppShell>
  );
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ""; }
      else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}
