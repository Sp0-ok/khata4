import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Camera, ChevronLeft, FileText, MessageCircle, MoreVertical,
  Phone, Trash2, Pencil, Upload, Download, X, ImagePlus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Avatar } from "./customers.index";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, getPartyBalance, getSettings, type PaymentMethod, type Transaction, type TxnType } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { downscaleImage } from "@/lib/image";
import { saveFile } from "@/lib/saveFile";
import { tapLight } from "@/lib/haptics";
const lazyPdf = () => import("@/lib/pdf");
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

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
  const [openTxnId, setOpenTxnId] = useState<number | null>(null);
  const [stmtOpen, setStmtOpen] = useState(false);

  const party = useLiveQuery(() => db.parties.get(pid), [pid]);
  const txns = useLiveQuery(
    () => db.transactions.where("partyId").equals(pid).toArray()
      .then(arr => arr.sort((a, b) => b.createdAt - a.createdAt)),
    [pid]
  );
  const openTxn = useLiveQuery(
    async () => openTxnId == null ? null : (await db.transactions.get(openTxnId)) ?? null,
    [openTxnId],
  );
  const balance = useLiveQuery(() => getPartyBalance(pid), [pid, txns?.length]) || 0;

  if (party === undefined) return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!party) return <AppShell><div className="p-6">Party not found.</div></AppShell>;

  const onShareReminder = async () => {
    const msg = balance > 0
      ? `Assalam-o-Alaikum ${party.name}, your pending balance is ${format(balance)}. Kindly clear at your convenience. — Hisaab Kitaab.`
      : balance < 0
      ? `Assalam-o-Alaikum ${party.name}, our pending balance with you is ${format(Math.abs(balance))}. Will settle soon. — Hisaab Kitaab`
      : `Assalam-o-Alaikum ${party.name}, your account is fully settled. Thank you!`;
    const { shareWhatsApp } = await lazyPdf();
    shareWhatsApp(party.phone, msg);
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
          updatedAt: now + i,
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
    await saveFile(`${party!.name.replace(/\s+/g, "_")}_transactions.csv`, "text/csv", csv);
  };

  // Owe-direction colours: party owes you (balance > 0) → red gradient + minus.
  const owesYou = balance > 0;

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
              <DropdownMenuItem onClick={() => setStmtOpen(true)}><FileText className="mr-2 h-4 w-4" /> Save statement</DropdownMenuItem>
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
          style={{
            background: owesYou
              ? "linear-gradient(135deg, var(--debit), oklch(0.5 0.18 25))"
              : "var(--gradient-primary)",
          }}
        >
          <div className="flex items-center gap-3">
            <Avatar name={party.name} photo={party.photo} size={48} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-base font-semibold">{party.name}</p>
              <p className="truncate text-xs opacity-90">{party.phone || "No phone"}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-widest opacity-80">
              {balance > 0 ? "You'll get" : balance < 0 ? "You'll give" : "Settled"}
            </p>
            <p className="text-3xl font-bold tabular">
              {owesYou ? "− " : ""}{format(Math.abs(balance))}
            </p>
          </div>
        </motion.div>
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pt-3">
        <Button variant="outline" className="h-11 rounded-xl" onClick={onShareReminder}>
          <MessageCircle className="mr-2 h-4 w-4" /> Reminder
        </Button>
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => setStmtOpen(true)}>
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
                <button
                  type="button"
                  onClick={() => { tapLight(); setOpenTxnId(t.id!); }}
                  className="w-full text-left"
                >
                  <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-accent/30 active:scale-[0.99]">
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
                      {t.attachment && <p className="mt-0.5 text-[10px] text-muted-foreground">📎</p>}
                    </div>
                  </Card>
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      <TxnDetailDialog
        txn={openTxn ?? null}
        onClose={() => setOpenTxnId(null)}
        onEdit={(t) => {
          setOpenTxnId(null);
          navigate({ to: "/customers/$id/txn/$txnId", params: { id, txnId: String(t.id) } });
        }}
        onAskDelete={(t) => { setOpenTxnId(null); setPendingDelete(t.id!); }}
      />

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

      <StatementDialog
        open={stmtOpen}
        onOpenChange={setStmtOpen}
        partyId={pid}
        partyName={party.name}
        symbol={symbol}
      />

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

function TxnDetailDialog({
  txn, onClose, onEdit, onAskDelete,
}: {
  txn: Transaction | null;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onAskDelete: (t: Transaction) => void;
}) {
  const { format } = useCurrency();
  const photoRef = useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!txn) return null;
  const created = txn.createdAt;
  const updated = txn.updatedAt || txn.createdAt;

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5MB)"); return; }
    try {
      const dataUrl = await downscaleImage(f, 1024);
      await db.transactions.update(txn.id!, { attachment: dataUrl, updatedAt: Date.now() });
      toast.success("Photo attached");
    } catch (err: any) { toast.error(err.message); }
    finally { e.target.value = ""; }
  };
  const removePhoto = async () => {
    await db.transactions.update(txn.id!, { attachment: undefined, updatedAt: Date.now() });
    setConfirmRemove(false);
    toast.success("Photo removed");
  };
  const saveAttachment = async () => {
    if (!txn.attachment) return;
    const m = txn.attachment.match(/^data:(.+?);base64,(.+)$/);
    if (!m) return;
    const mime = m[1];
    const ext = mime.includes("png") ? "png" : "jpg";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { tsSuffix } = await lazyPdf();
    await saveFile(`receipt_${txn.id}_${tsSuffix()}.${ext}`, mime, bytes);
  };

  return (
    <>
      <Dialog open={!!txn} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={txn.type === "credit" ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]"}>
              {txn.type === "credit" ? "You got" : "You gave"} · {format(txn.amount)}
            </DialogTitle>
            <DialogDescription>
              {txn.note || (txn.type === "credit" ? "Received" : "Given")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <Row label="Method"><span className="capitalize">{txn.method}</span></Row>
            <Row label="Created">{new Date(created).toLocaleString()}</Row>
            <Row label="Last modified">{new Date(updated).toLocaleString()}</Row>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Attachment</p>
              {txn.attachment ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setViewerOpen(true)}
                    className="block overflow-hidden rounded-xl border border-border"
                  >
                    <img src={txn.attachment} alt="Attachment" className="max-h-44 w-full object-contain" />
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewerOpen(true)}>
                      <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> View
                    </Button>
                    <Button size="sm" variant="outline" onClick={saveAttachment}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Save image
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => photoRef.current?.click()}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Replace
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmRemove(true)}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                  <ImagePlus className="mr-2 h-4 w-4" /> Add photo
                </Button>
              )}
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" onClick={() => onEdit(txn)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
            <Button variant="destructive" onClick={() => onAskDelete(txn)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {txn.attachment && (
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="max-w-2xl p-2">
            <img src={txn.attachment} alt="Attachment" className="max-h-[80vh] w-full rounded-lg object-contain" />
            <div className="flex justify-end gap-2 px-2 pb-2">
              <Button size="sm" variant="outline" onClick={saveAttachment}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Save image
              </Button>
              <Button size="sm" onClick={() => setViewerOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this photo?</AlertDialogTitle>
            <AlertDialogDescription>The attached image will be deleted from this entry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removePhoto}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

function StatementDialog({
  open, onOpenChange, partyId, partyName, symbol,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partyId: number;
  partyName: string;
  symbol: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const generate = async (full: boolean) => {
    setBusy(true);
    try {
      const party = await db.parties.get(partyId);
      if (!party) throw new Error("Party not found");
      const settings = await getSettings();
      const { generateStatementPDF, tsSuffix } = await lazyPdf();
      const range = full ? undefined : {
        from: new Date(from).getTime(),
        to: new Date(to).getTime() + 86_399_000,
      };
      const doc = await generateStatementPDF(party, settings.businessName, symbol, range, {
        watermark: settings.statementWatermark !== false,
        currency: settings.currency,
      });
      const blob = doc.output("blob");
      const tag = full ? "full" : `${from}_${to}`;
      await saveFile(
        `${partyName.replace(/\s+/g, "_")}_statement_${tag}_${tsSuffix()}.pdf`,
        "application/pdf",
        blob,
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save statement</DialogTitle>
          <DialogDescription>
            Pick a date range or save the entire history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} />
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" disabled={busy} onClick={() => generate(true)}>
            Full statement
          </Button>
          <Button disabled={busy} onClick={() => generate(false)}>
            {busy ? "Saving…" : "Save range"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// Suppress an unused-import warning while keeping Camera available for future use.
void Camera;
