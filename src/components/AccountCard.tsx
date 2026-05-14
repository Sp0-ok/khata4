import { useState } from "react";
import { Cloud, CloudOff, LogOut, RefreshCw, Trash2, UserCog, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  signInWithGoogle, signOut, switchAccount, pushSync, restoreFromCloud,
  deleteCloudBackup, useAuthUser, useSyncStatus,
} from "@/lib/sync";
import { CloudDownload, CloudUpload } from "lucide-react";

function relTime(ms: number | null): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 30_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} hr ago`;
  const d = new Date(ms);
  return d.toLocaleString();
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.226c1.886-1.737 2.988-4.296 2.988-7.351z"/>
      <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.612-2.422l-3.226-2.51c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.598-4.122H3.064v2.59A9.997 9.997 0 0 0 12 22z"/>
      <path fill="#FBBC04" d="M6.402 13.901A6.005 6.005 0 0 1 6.09 12c0-.66.114-1.301.312-1.901v-2.59H3.064A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.064 4.491l3.338-2.59z"/>
      <path fill="#EA4335" d="M12 6.977c1.47 0 2.789.506 3.827 1.498l2.864-2.864C16.96 3.99 14.696 3 12 3a9.997 9.997 0 0 0-8.936 5.509l3.338 2.59C7.19 8.737 9.395 6.977 12 6.977z"/>
    </svg>
  );
}

export function AccountCard() {
  const { user, loading } = useAuthUser();
  const { status, lastSyncAt, error } = useSyncStatus();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    const r = await signInWithGoogle();
    if (r.error) toast.error(r.error.message);
    setBusy(false);
  };

  const handleSync = async () => {
    setBusy(true);
    try { await pushSync(); toast.success("Backed up to cloud"); }
    catch (e: any) { toast.error(e?.message || "Sync failed"); }
    finally { setBusy(false); }
  };

  const handleSwitch = async () => {
    setBusy(true);
    const r = await switchAccount();
    if (r.error) toast.error(r.error.message);
    setBusy(false);
  };

  if (loading) {
    return (
      <Card className="rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading account…
        </div>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="space-y-3 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CloudOff className="h-4 w-4 text-muted-foreground" /> Cloud backup
        </div>
        <p className="text-xs text-muted-foreground leading-snug">
          Sign in with Google to auto-backup your data. If you lose your phone, just install the app and sign in to get everything back.
          <br />
          <span className="text-[10px] opacity-70">(Photos &amp; receipts are not synced — data only.)</span>
        </p>
        <Button onClick={handleSignIn} disabled={busy} className="h-11 w-full justify-center rounded-xl bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black border border-border">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-5 w-5" />}
          Sign in with Google
        </Button>
      </Card>
    );
  }

  const avatar = user.picture;
  const name = user.name || user.email;

  let StatusIcon = Cloud;
  let statusColor = "text-muted-foreground";
  let statusText = `Last synced ${relTime(lastSyncAt)}`;
  if (status === "syncing") { StatusIcon = Loader2; statusColor = "text-primary"; statusText = "Syncing…"; }
  else if (status === "synced") { StatusIcon = CheckCircle2; statusColor = "text-emerald-500"; }
  else if (status === "error") { StatusIcon = AlertCircle; statusColor = "text-destructive"; statusText = error || "Sync failed"; }

  return (
    <Card className="space-y-3 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Cloud className="h-4 w-4 text-primary" /> Cloud backup
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {avatar
            ? <img src={avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            : <UserCog className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
          <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${statusColor}`}>
            <StatusIcon className={`h-3 w-3 ${status === "syncing" ? "animate-spin" : ""}`} />
            <span className="truncate">{statusText}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled={busy || status === "syncing"} onClick={handleSync}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${status === "syncing" ? "animate-spin" : ""}`} /> Sync now
        </Button>
        <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled={busy} onClick={handleSwitch}>
          <UserCog className="mr-1.5 h-3.5 w-3.5" /> Switch account
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled={busy}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of {user.email}?</AlertDialogTitle>
              <AlertDialogDescription>
                Your data on this device stays untouched. Cloud backup pauses until you sign in again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await signOut(); toast.success("Signed out"); }}>
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 rounded-xl text-destructive hover:text-destructive" disabled={busy}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete cloud
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete cloud backup?</AlertDialogTitle>
              <AlertDialogDescription>
                Removes your backup from the cloud. Your local data stays intact. Auto-sync will recreate a backup on the next change.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try { await deleteCloudBackup(); toast.success("Cloud backup deleted"); }
                  catch (e: any) { toast.error(e?.message || "Delete failed"); }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
