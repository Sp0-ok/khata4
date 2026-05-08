import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, FileText, MessageCircle, MoreVertical,
  Phone, Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Avatar } from "./customers.index";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db, getPartyBalance, getSettings } from "@/lib/db";
import { useCurrency } from "@/lib/hooks";
import { downloadStatement, shareWhatsApp } from "@/lib/pdf";
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
  head: () => ({ meta: [{ title: "Khata — BahiBook" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const pid = Number(id);
  const navigate = useNavigate();
  const { format, symbol } = useCurrency();

  const party = useLiveQuery(() => db.parties.get(pid), [pid]);
  const txns = useLiveQuery(
    () => db.transactions.where("partyId").equals(pid).reverse().sortBy("date").then(a => a.reverse()),
    [pid]
  );
  const balance = useLiveQuery(() => getPartyBalance(pid), [pid, txns?.length]) || 0;

  if (party === undefined) return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!party) return <AppShell><div className="p-6">Party not found.</div></AppShell>;

  const onShareReminder = () => {
    const msg = balance > 0
      ? `Assalam-o-Alaikum ${party.name}, your pending balance is ${format(balance)}. Kindly clear at your convenience. — Sent via BahiBook.`
      : balance < 0
      ? `Assalam-o-Alaikum ${party.name}, our pending balance with you is ${format(balance)}. Will settle soon. — BahiBook`
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

  const onDelete = async () => {
    await db.transaction("rw", db.parties, db.transactions, async () => {
      await db.transactions.where("partyId").equals(pid).delete();
      await db.parties.delete(pid);
    });
    toast.success("Party deleted");
    navigate({ to: "/customers" });
  };

  return (
    <AppShell hideNav>
      <PageHeader
        title={party.name}
        subtitle={party.type === "customer" ? "Customer" : "Supplier"}
        back={<Link to="/customers" className="rounded-full p-1 hover:bg-accent"><ChevronLeft className="h-5 w-5" /></Link>}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full p-1 hover:bg-accent"><MoreVertical className="h-5 w-5" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownloadPDF}><FileText className="mr-2 h-4 w-4" /> Download statement</DropdownMenuItem>
              <DropdownMenuItem onClick={onShareReminder}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp reminder</DropdownMenuItem>
              {party.phone && (
                <DropdownMenuItem asChild><a href={`tel:${party.phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a></DropdownMenuItem>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive" onSelect={e => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
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
                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

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
          {txns?.map(t => (
            <Card key={t.id} className="flex items-center gap-3 p-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                t.type === "credit" ? "bg-[color:var(--credit)]/15 text-[color:var(--credit)]" : "bg-[color:var(--debit)]/15 text-[color:var(--debit)]"
              )}>
                {t.type === "credit" ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{t.note || (t.type === "credit" ? "Received" : "Given")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(t.date).toLocaleDateString()} · {t.method}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("text-sm font-bold tabular", t.type === "credit" ? "text-[color:var(--credit)]" : "text-[color:var(--debit)]")}>
                  {format(t.amount)}
                </p>
                <button
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await db.transactions.delete(t.id!);
                    toast.success("Transaction deleted");
                  }}
                >Delete</button>
              </div>
            </Card>
          ))}
        </div>
      </section>

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
