import { useEffect, useState } from "react";
import { Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuthUser, useSyncStatus, pushSync } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function relTime(ms: number | null): string {
  if (!ms) return "never";
  const d = Date.now() - ms;
  if (d < 30_000) return "just now";
  if (d < 60_000) return `${Math.round(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} hr ago`;
  return new Date(ms).toLocaleDateString();
}

function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function SyncStatusBadge({ className }: { className?: string }) {
  const { user } = useAuthUser();
  const { status, lastSyncAt, error } = useSyncStatus();
  const online = useOnline();
  const [retrying, setRetrying] = useState(false);

  if (!user) return null;

  let Icon = Cloud;
  let color = "text-muted-foreground";
  let label = `Synced ${relTime(lastSyncAt)}`;
  let showRetry = false;

  if (!online) {
    Icon = CloudOff;
    color = "text-muted-foreground";
    label = "Offline";
  } else if (status === "syncing") {
    Icon = Loader2;
    color = "text-primary";
    label = "Syncing…";
  } else if (status === "error") {
    Icon = AlertCircle;
    color = "text-destructive";
    label = error || "Sync failed";
    showRetry = true;
  } else if (status === "synced" || lastSyncAt) {
    Icon = CheckCircle2;
    color = "text-emerald-500";
    label = `Synced ${relTime(lastSyncAt)}`;
  }

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await pushSync();
      toast.success("Synced");
    } catch (e: any) {
      toast.error(e?.message || "Sync failed");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1 text-[10px] font-medium",
        color,
        className,
      )}
      title={label}
    >
      <Icon className={cn("h-3 w-3", status === "syncing" && "animate-spin")} />
      <span className="hidden xs:inline max-w-[110px] truncate sm:inline">{label}</span>
      {showRetry && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="ml-0.5 rounded-full p-0.5 hover:bg-background/60 disabled:opacity-50"
          aria-label="Retry sync"
        >
          <RefreshCw className={cn("h-3 w-3", retrying && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
