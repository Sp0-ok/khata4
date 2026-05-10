// Mounts once globally; listens for "hk:pick-folder" requests and asks the
// user which folder downloads should be saved to. The choice is returned via
// the event detail's `resolve` callback (see saveFile.ts).
import { useEffect, useState } from "react";
import { Folder, Download as DownloadIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Resolver = (v: "documents" | "downloads" | null) => void;

export function SaveFolderPicker() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Resolver | null>(null);
  const [choice, setChoice] = useState<"documents" | "downloads">("downloads");

  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent<{ resolve: Resolver }>).detail;
      setPending(() => detail.resolve);
      setOpen(true);
    };
    window.addEventListener("hk:pick-folder", onPick as EventListener);
    return () => window.removeEventListener("hk:pick-folder", onPick as EventListener);
  }, []);

  const finish = (v: "documents" | "downloads" | null) => {
    pending?.(v);
    setPending(null);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) finish(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Where should files be saved?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose once — Hisaab Kitaab will save all PDFs and exports here from now on.
            You can change this later in Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setChoice("downloads")}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs ${
              choice === "downloads" ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <DownloadIcon className="h-5 w-5" /> Downloads
            <span className="text-[10px] text-muted-foreground">/Download/HisaabKitaab</span>
          </button>
          <button
            onClick={() => setChoice("documents")}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs ${
              choice === "documents" ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <Folder className="h-5 w-5" /> Documents
            <span className="text-[10px] text-muted-foreground">/Documents/HisaabKitaab</span>
          </button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(choice)}>Save here</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
