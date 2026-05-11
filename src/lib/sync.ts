// Cloud backup & restore (data only — no images).
// One row per user in `backups`. Last-write wins.
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { db, DEFAULT_SETTINGS } from "@/lib/db";

const DEVICE_ID_KEY = "hk_device_id";
const LAST_PUSH_KEY = "hk_last_push_at"; // ms epoch — last successful push from THIS device
const LAST_SYNC_KEY = "hk_last_sync_at"; // ms epoch — last successful pull/push of any kind

export function getDeviceId(): string {
  try {
    let v = localStorage.getItem(DEVICE_ID_KEY);
    if (!v) {
      v = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
      localStorage.setItem(DEVICE_ID_KEY, v);
    }
    return v;
  } catch { return "anon"; }
}

function getDeviceName(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Android/i.test(ua)) return "Android device";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS device";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

// ---------- snapshot ----------

type Snapshot = {
  version: 2;
  exportedAt: string;
  parties: any[];
  transactions: any[];
  invoices: any[];
  expenses: any[];
  settings: any[];
};

function stripPhoto<T extends Record<string, any>>(rec: T): T {
  if (rec && typeof rec === "object" && "photo" in rec) {
    const { photo: _omit, ...rest } = rec;
    return rest as T;
  }
  return rec;
}
function stripAttachment<T extends Record<string, any>>(rec: T): T {
  if (rec && typeof rec === "object" && "attachment" in rec) {
    const { attachment: _omit, ...rest } = rec;
    return rest as T;
  }
  return rec;
}
function stripLogo<T extends Record<string, any>>(rec: T): T {
  if (rec && typeof rec === "object" && "logo" in rec) {
    const { logo: _omit, ...rest } = rec;
    return rest as T;
  }
  return rec;
}

export async function buildSnapshot(): Promise<Snapshot> {
  const [parties, transactions, invoices, expenses, settings] = await Promise.all([
    db.parties.toArray(),
    db.transactions.toArray(),
    db.invoices.toArray(),
    db.expenses.toArray(),
    db.settings.toArray(),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    parties: parties.map(stripPhoto),
    transactions: transactions.map(stripAttachment),
    invoices,
    expenses: expenses.map(stripAttachment),
    settings: settings.map(stripLogo),
  };
}

export async function applySnapshot(snap: any): Promise<void> {
  if (!snap || !Array.isArray(snap.parties) || !Array.isArray(snap.transactions)) {
    throw new Error("Invalid backup payload");
  }
  await db.transaction(
    "rw",
    [db.parties, db.transactions, db.invoices, db.expenses, db.settings],
    async () => {
      await db.parties.clear();
      await db.transactions.clear();
      await db.invoices.clear();
      await db.expenses.clear();

      const idMap = new Map<number, number>();
      for (const p of snap.parties) {
        const { id: oldId, ...rest } = p;
        const newId = await db.parties.add(rest);
        if (oldId != null) idMap.set(Number(oldId), newId);
      }
      const txns = (snap.transactions as any[])
        .map(t => {
          const { id: _i, partyId, ...rest } = t;
          const mapped = idMap.get(Number(partyId));
          if (mapped == null) return null;
          return { ...rest, partyId: mapped };
        })
        .filter(Boolean) as any[];
      if (txns.length) await db.transactions.bulkAdd(txns);

      if (Array.isArray(snap.invoices)) {
        const invs = snap.invoices.map((i: any) => {
          const { id: _i, partyId, ...rest } = i;
          return { ...rest, partyId: partyId != null ? idMap.get(Number(partyId)) : undefined };
        });
        if (invs.length) await db.invoices.bulkAdd(invs);
      }
      if (Array.isArray(snap.expenses)) {
        await db.expenses.bulkAdd(
          snap.expenses.map((x: any) => { const { id: _i, ...r } = x; return r; }),
        );
      }
      if (Array.isArray(snap.settings) && snap.settings[0]) {
        const cur = await db.settings.toArray();
        const { id: _sid, ...patch } = snap.settings[0];
        if (cur[0]) await db.settings.update(cur[0].id!, { ...DEFAULT_SETTINGS, ...patch });
        else await db.settings.add({ ...DEFAULT_SETTINGS, ...patch });
      }
    },
  );
}

// ---------- status store ----------

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";
type StatusState = { status: SyncStatus; lastSyncAt: number | null; error?: string };

let _state: StatusState = {
  status: "idle",
  lastSyncAt: typeof localStorage !== "undefined"
    ? Number(localStorage.getItem(LAST_SYNC_KEY) || 0) || null
    : null,
};
const _listeners = new Set<() => void>();
function setState(p: Partial<StatusState>) {
  _state = { ..._state, ...p };
  if (p.lastSyncAt != null) {
    try { localStorage.setItem(LAST_SYNC_KEY, String(p.lastSyncAt)); } catch {}
  }
  _listeners.forEach(l => l());
}
export function useSyncStatus(): StatusState {
  return useSyncExternalStore(
    cb => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _state,
    () => _state,
  );
}

// ---------- cloud ops ----------

async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function pushSync(): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");
  setState({ status: "syncing", error: undefined });
  try {
    const snap = await buildSnapshot();
    const json = JSON.stringify(snap);
    const sizeBytes = new Blob([json]).size;
    const now = new Date();
    const { error } = await supabase.from("backups").upsert({
      user_id: user.id,
      payload: snap as any,
      device_id: getDeviceId(),
      device_name: getDeviceName(),
      size_bytes: sizeBytes,
      updated_at: now.toISOString(),
    });
    if (error) throw error;
    try { localStorage.setItem(LAST_PUSH_KEY, String(now.getTime())); } catch {}
    setState({ status: "synced", lastSyncAt: now.getTime() });
  } catch (e: any) {
    setState({ status: "error", error: e?.message || String(e) });
    throw e;
  }
}

export async function pullSync(): Promise<{
  payload: any;
  device_id: string | null;
  device_name: string | null;
  updated_at: string;
} | null> {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("backups")
    .select("payload, device_id, device_name, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function deleteCloudBackup(): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("backups").delete().eq("user_id", user.id);
  if (error) throw error;
}

/** Restore cloud backup over local data (destructive). */
export async function restoreFromCloud(): Promise<void> {
  setState({ status: "syncing", error: undefined });
  try {
    const row = await pullSync();
    if (!row) throw new Error("No cloud backup found");
    await applySnapshot(row.payload);
    const t = Date.now();
    try { localStorage.setItem(LAST_PUSH_KEY, String(t)); } catch {}
    setState({ status: "synced", lastSyncAt: t });
  } catch (e: any) {
    setState({ status: "error", error: e?.message || String(e) });
    throw e;
  }
}

// ---------- mutation watcher ----------

let _hooksInstalled = false;
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _autoEnabled = false;
const PUSH_DEBOUNCE_MS = 3000;

function schedulePush() {
  if (!_autoEnabled) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pushSync().catch(err => console.warn("[sync] push failed", err));
  }, PUSH_DEBOUNCE_MS);
}

function installDexieHooks() {
  if (_hooksInstalled) return;
  _hooksInstalled = true;
  const tables = [db.parties, db.transactions, db.invoices, db.expenses, db.settings];
  for (const t of tables) {
    t.hook("creating", () => { schedulePush(); });
    t.hook("updating", () => { schedulePush(); });
    t.hook("deleting", () => { schedulePush(); });
  }
}

// ---------- auth hook ----------

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return { user, loading };
}

// ---------- master hook ----------

export type FirstSyncDecision = {
  needsDecision: true;
  cloudUpdatedAt: string;
  cloudDevice: string | null;
} | { needsDecision: false };

/**
 * Mounts auto-sync side effects: installs Dexie mutation hooks, runs an
 * initial sync on sign-in, and pushes a debounced backup after every local
 * change. Returns a callback that yields a "first-sync decision" the UI can
 * use to prompt the user (restore vs. overwrite cloud).
 */
export function useAutoSync(): {
  user: User | null;
  loading: boolean;
  pendingDecision: { cloudUpdatedAt: string; cloudDevice: string | null } | null;
  resolveDecision: (action: "restore" | "overwrite" | "dismiss") => Promise<void>;
} {
  const { user, loading } = useAuthUser();
  const [pending, setPending] = useState<
    { cloudUpdatedAt: string; cloudDevice: string | null } | null
  >(null);

  // Install hooks once.
  useEffect(() => { installDexieHooks(); }, []);

  // When user changes: enable/disable auto-push and run initial sync.
  useEffect(() => {
    if (!user) { _autoEnabled = false; setPending(null); return; }
    _autoEnabled = true;

    let cancelled = false;
    (async () => {
      try {
        const row = await pullSync();
        if (cancelled) return;
        if (!row) {
          // Nothing in the cloud — push current local data as the initial backup.
          await pushSync();
          return;
        }
        // Compare cloud timestamp vs this device's last push.
        const lastPush = Number(localStorage.getItem(LAST_PUSH_KEY) || 0);
        const cloudMs = new Date(row.updated_at).getTime();
        const sameDevice = row.device_id && row.device_id === getDeviceId();

        if (sameDevice) {
          // Our own backup — silently push any newer local changes.
          await pushSync();
        } else if (cloudMs > lastPush + 1000) {
          // Cloud is from another device and newer — ask the user.
          setPending({
            cloudUpdatedAt: row.updated_at,
            cloudDevice: row.device_name ?? null,
          });
        } else {
          await pushSync();
        }
      } catch (e: any) {
        console.warn("[sync] initial sync failed", e);
        setState({ status: "error", error: e?.message || String(e) });
      }
    })();

    return () => { cancelled = true; _autoEnabled = false; };
  }, [user?.id]);

  const resolveDecision = async (action: "restore" | "overwrite" | "dismiss") => {
    if (action === "restore") {
      await restoreFromCloud();
    } else if (action === "overwrite") {
      await pushSync();
    }
    setPending(null);
  };

  return { user, loading, pendingDecision: pending, resolveDecision };
}

// ---------- auth actions ----------

export async function signInWithGoogle(): Promise<{ error?: Error }> {
  const { lovable } = await import("@/integrations/lovable");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) return { error: result.error instanceof Error ? result.error : new Error(String(result.error)) };
  return {};
}

export async function signOut(): Promise<void> {
  _autoEnabled = false;
  await supabase.auth.signOut();
}

/** Sign out then immediately start a Google sign-in flow. */
export async function switchAccount(): Promise<{ error?: Error }> {
  await signOut();
  const { lovable } = await import("@/integrations/lovable");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
    extraParams: { prompt: "select_account" },
  });
  if (result.error) return { error: result.error instanceof Error ? result.error : new Error(String(result.error)) };
  return {};
}
