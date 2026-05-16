// Cloud backup & restore via Google Drive AppData (data only — no images).
// Replaces the previous Supabase-backed implementation. Last-write wins.

import { useEffect, useState, useSyncExternalStore } from "react";
import { db, DEFAULT_SETTINGS } from "@/lib/db";
import {
  signIn as gSignIn,
  signOut as gSignOut,
  getStoredProfile,
  onAuthChange,
  uploadBackup,
  downloadBackup,
  getBackupMeta,
  deleteBackup,
  isSignedIn as gIsSignedIn,
  type GoogleProfile,
} from "@/lib/google-drive";

const LAST_PUSH_KEY = "hk_last_push_at";
const LAST_SYNC_KEY = "hk_last_sync_at";
const FIRST_RUN_KEY = "hk_first_run_done";

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

const stripField = (field: string) =>
  <T extends Record<string, any>>(rec: T): T => {
    if (rec && typeof rec === "object" && field in rec) {
      const { [field]: _omit, ...rest } = rec;
      return rest as T;
    }
    return rec;
  };
const stripPhoto = stripField("photo");
const stripAttachment = stripField("attachment");
const stripLogo = stripField("logo");

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
        .map((t) => {
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
  _listeners.forEach((l) => l());
}
export function useSyncStatus(): StatusState {
  return useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    () => _state,
    () => _state,
  );
}

// ---------- cloud ops ----------

export async function pushSync(): Promise<void> {
  if (!gIsSignedIn()) throw new Error("Not signed in");
  setState({ status: "syncing", error: undefined });
  try {
    const snap = await buildSnapshot();
    await uploadBackup(snap);
    const now = Date.now();
    try { localStorage.setItem(LAST_PUSH_KEY, String(now)); } catch {}
    setState({ status: "synced", lastSyncAt: now });
  } catch (e: any) {
    setState({ status: "error", error: e?.message || String(e) });
    throw e;
  }
}

export async function restoreFromCloud(): Promise<void> {
  if (!gIsSignedIn()) throw new Error("Not signed in");
  setState({ status: "syncing", error: undefined });
  try {
    const payload = await downloadBackup();
    if (!payload) throw new Error("No cloud backup found");
    await applySnapshot(payload);
    const t = Date.now();
    try { localStorage.setItem(LAST_PUSH_KEY, String(t)); } catch {}
    setState({ status: "synced", lastSyncAt: t });
  } catch (e: any) {
    setState({ status: "error", error: e?.message || String(e) });
    throw e;
  }
}

export async function deleteCloudBackup(): Promise<void> {
  if (!gIsSignedIn()) throw new Error("Not signed in");
  await deleteBackup();
}

// ---------- mutation watcher (debounced auto-push) ----------

let _hooksInstalled = false;
let _pushTimer: ReturnType<typeof setTimeout> | null = null;
let _autoEnabled = false;
const PUSH_DEBOUNCE_MS = 3000;

function schedulePush() {
  if (!_autoEnabled) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pushSync().catch((err) => console.warn("[sync] push failed", err));
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

// ---------- auth state hook ----------

export function useAuthUser() {
  const [user, setUser] = useState<GoogleProfile | null>(getStoredProfile());
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    return onAuthChange(() => setUser(getStoredProfile()));
  }, []);
  return { user, loading };
}

// ---------- master auto-sync hook ----------

export function useAutoSync(): {
  user: GoogleProfile | null;
  loading: boolean;
  pendingDecision: { cloudUpdatedAt: string; cloudDevice: string | null } | null;
  resolveDecision: (action: "restore" | "overwrite" | "dismiss") => Promise<void>;
} {
  const { user, loading } = useAuthUser();
  const [pending, setPending] = useState<
    { cloudUpdatedAt: string; cloudDevice: string | null } | null
  >(null);

  useEffect(() => { installDexieHooks(); }, []);

  useEffect(() => {
    if (!user) { _autoEnabled = false; setPending(null); return; }
    _autoEnabled = true;

    let cancelled = false;
    (async () => {
      try {
        const meta = await getBackupMeta();
        if (cancelled) return;
        if (!meta) {
          await pushSync();
          return;
        }
        // If local DB is empty but cloud has a backup, silently restore —
        // avoids accidentally wiping cloud when signing in on a fresh install.
        const [txnCount, partyCount] = await Promise.all([
          db.transactions.count(),
          db.parties.count(),
        ]);
        if (txnCount === 0 && partyCount === 0) {
          await restoreFromCloud();
          return;
        }
        const lastPush = Number(localStorage.getItem(LAST_PUSH_KEY) || 0);
        const cloudMs = new Date(meta.modifiedTime).getTime();
        if (cloudMs > lastPush + 2000) {
          // Cloud is newer than what this device last pushed — ask user.
          setPending({ cloudUpdatedAt: meta.modifiedTime, cloudDevice: null });
        } else {
          await pushSync();
        }
      } catch (e: any) {
        console.warn("[sync] initial sync failed", e);
        setState({ status: "error", error: e?.message || String(e) });
      }
    })();

    return () => { cancelled = true; _autoEnabled = false; };
  }, [user?.email]);

  // Re-push when the app comes back to the foreground.
  useEffect(() => {
    if (!user) return;
    const onVis = () => { if (document.visibilityState === "visible") schedulePush(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user?.email]);

  const resolveDecision = async (action: "restore" | "overwrite" | "dismiss") => {
    if (action === "restore") await restoreFromCloud();
    else if (action === "overwrite") await pushSync();
    setPending(null);
  };

  return { user, loading, pendingDecision: pending, resolveDecision };
}

// ---------- auth actions ----------

export async function signInWithGoogle(): Promise<{ error?: Error }> {
  try {
    await gSignIn();
    try { localStorage.setItem(FIRST_RUN_KEY, "1"); } catch {}
    return {};
  } catch (e: any) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function signOut(): Promise<void> {
  _autoEnabled = false;
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  await gSignOut();
  await clearAllLocalData();
  setState({ status: "idle", lastSyncAt: null, error: undefined });
}

/**
 * Wipes every Dexie table and sync-related localStorage keys so a fresh
 * sign-in starts from a clean slate (and pulls the new account's cloud data).
 */
export async function clearAllLocalData(): Promise<void> {
  // Preserve the settings row (including the `onboarded` flag) so signing out
  // or switching accounts never re-triggers the first-run welcome flow.
  // Cloud restore will overwrite settings with the new account's snapshot.
  try {
    await db.transaction(
      "rw",
      [db.parties, db.transactions, db.invoices, db.expenses],
      async () => {
        await db.parties.clear();
        await db.transactions.clear();
        await db.invoices.clear();
        await db.expenses.clear();
      },
    );
  } catch (e) { console.warn("[sync] clear local data failed", e); }
  try {
    localStorage.removeItem(LAST_PUSH_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
    // NOTE: keep FIRST_RUN_KEY so onboarding only shows on first install.
  } catch {}
}

export async function switchAccount(): Promise<{ error?: Error }> {
  await signOut();
  try {
    await gSignIn({ selectAccount: true });
    return {};
  } catch (e: any) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// ---------- first-run helper ----------

export function hasSeenFirstRunPrompt(): boolean {
  try { return localStorage.getItem(FIRST_RUN_KEY) === "1"; } catch { return true; }
}
export function markFirstRunSeen() {
  try { localStorage.setItem(FIRST_RUN_KEY, "1"); } catch {}
}
