// Opens the Dexie database eagerly on the client and exposes a hook
// the app can use to gate its first paint. Prevents a flash of empty
// state inside the Android WebView while IndexedDB is still warming up.
import { useEffect, useState } from "react";
import { db } from "./db";

let readyPromise: Promise<void> | null = null;

export function ensureDbOpen(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!readyPromise) {
    readyPromise = db.open().then(() => undefined).catch((err) => {
      console.error("[db] failed to open", err);
      // Retry once after a tick — Android WebView occasionally races.
      return new Promise<void>((resolve) => {
        setTimeout(() => db.open().then(() => resolve()).catch(() => resolve()), 200);
      });
    });
  }
  return readyPromise;
}

export function useDbReady(): boolean {
  const [ready, setReady] = useState(typeof window === "undefined" ? false : false);
  useEffect(() => {
    let alive = true;
    ensureDbOpen().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}
