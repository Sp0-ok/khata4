import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, UserPlus } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db, type TxnType } from "@/lib/db";
import { Avatar } from "@/routes/customers.index";

export function PartyPickerSheet({
  trigger,
  title,
  txnType,
}: {
  trigger: ReactNode;
  title: string;
  txnType: TxnType;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const parties = useLiveQuery(
    () => db.parties.orderBy("updatedAt").reverse().toArray(),
    []
  );
  const list = (parties || []).filter(
    p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.phone || "").includes(q)
  );

  const pick = (id: number) => {
    setOpen(false);
    nav({ to: "/customers/$id/add", params: { id: String(id) }, search: { type: txnType } });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="h-11 rounded-xl pl-9" />
          </div>
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
            {list.length === 0 && (
              <div className="rounded-2xl border border-dashed p-6 text-center">
                <p className="text-sm font-medium">No parties yet</p>
                <p className="mb-3 text-xs text-muted-foreground">Add one to start recording.</p>
                <Button size="sm" onClick={() => { setOpen(false); nav({ to: "/customers/new" }); }}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add party
                </Button>
              </div>
            )}
            {list.map(p => (
              <button
                key={p.id}
                onClick={() => pick(p.id!)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-accent"
              >
                <Avatar name={p.name} photo={p.photo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.phone || "Party"}</p>
                </div>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setOpen(false); nav({ to: "/customers/new" }); }}
          >
            <UserPlus className="mr-2 h-4 w-4" /> New party
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
