// Google Identity Services + Drive AppData client.
// - Web: GIS token client (popup) for sign-in & token refresh.
// - Capacitor (Android): @capacitor/browser opens Google's OAuth in the
//   system browser; we handle the deep-link redirect via @capacitor/app.
//
// Tokens are kept in-memory + localStorage. Refreshes happen silently via
// `prompt: ""`; if that fails, the user is asked to sign in again.

import {
  GOOGLE_CLIENT_ID,
  FULL_SCOPES,
  BACKUP_FILE_NAME,
  ANDROID_REDIRECT_URI,
} from "./google-config";

const TOKEN_KEY = "hk_google_token";
const PROFILE_KEY = "hk_google_profile";
const PKCE_VERIFIER_KEY = "hk_pkce_verifier";

export type GoogleProfile = {
  email: string;
  name?: string;
  picture?: string;
  sub?: string;
};

type StoredToken = {
  access_token: string;
  expires_at: number; // ms epoch
};

// ---------------- token store ----------------

let _token: StoredToken | null = null;

function loadToken(): StoredToken | null {
  if (_token) return _token;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (!t?.access_token || !t.expires_at) return null;
    _token = t;
    return t;
  } catch { return null; }
}

function saveToken(t: StoredToken | null) {
  _token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function getStoredProfile(): GoogleProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as GoogleProfile) : null;
  } catch { return null; }
}

function saveProfile(p: GoogleProfile | null) {
  try {
    if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {}
}

export function isSignedIn(): boolean {
  return !!getStoredProfile();
}

export function clearAuth() {
  saveToken(null);
  saveProfile(null);
  try { localStorage.removeItem(PKCE_VERIFIER_KEY); } catch {}
}

// ---------------- platform detection ----------------

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

// ---------------- GIS loader (web) ----------------

let _gisPromise: Promise<void> | null = null;

function loadGIS(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (_gisPromise) return _gisPromise;
  _gisPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return _gisPromise;
}

// ---------------- profile fetch ----------------

async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Profile fetch failed (${res.status})`);
  const j = await res.json();
  return { email: j.email, name: j.name, picture: j.picture, sub: j.sub };
}

// ---------------- web sign-in (GIS) ----------------

async function signInWeb(opts?: { selectAccount?: boolean }): Promise<GoogleProfile> {
  await loadGIS();
  const google = (window as any).google;
  return new Promise<GoogleProfile>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: FULL_SCOPES,
      prompt: opts?.selectAccount ? "select_account" : "consent",
      callback: async (resp: any) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        const expiresIn = Number(resp.expires_in || 3600);
        saveToken({
          access_token: resp.access_token,
          expires_at: Date.now() + (expiresIn - 60) * 1000,
        });
        try {
          const p = await fetchProfile(resp.access_token);
          saveProfile(p);
          _emitAuth();
          resolve(p);
        } catch (e) { reject(e); }
      },
      error_callback: (err: any) => reject(new Error(err?.message || "Sign-in cancelled")),
    });
    client.requestAccessToken();
  });
}

async function refreshTokenWeb(): Promise<string | null> {
  // Silent refresh via GIS — works only if user has granted before.
  try {
    await loadGIS();
    const google = (window as any).google;
    return await new Promise<string | null>((resolve) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: FULL_SCOPES,
        prompt: "",
        callback: (resp: any) => {
          if (resp.error || !resp.access_token) return resolve(null);
          const expiresIn = Number(resp.expires_in || 3600);
          saveToken({
            access_token: resp.access_token,
            expires_at: Date.now() + (expiresIn - 60) * 1000,
          });
          resolve(resp.access_token);
        },
        error_callback: () => resolve(null),
      });
      client.requestAccessToken();
    });
  } catch { return null; }
}

// ---------------- native sign-in (Capacitor + system browser) ----------------

function randomString(n: number): string {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => ("0" + b.toString(16)).slice(-2)).join("");
}

async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(48);
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return { verifier, challenge: b64 };
}

async function signInNative(opts?: { selectAccount?: boolean }): Promise<GoogleProfile> {
  const { Browser } = await import("@capacitor/browser");
  const { App } = await import("@capacitor/app");

  const { verifier, challenge } = await pkce();
  try { localStorage.setItem(PKCE_VERIFIER_KEY, verifier); } catch {}

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: ANDROID_REDIRECT_URI,
    response_type: "code",
    scope: FULL_SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    include_granted_scopes: "true",
  });
  if (opts?.selectAccount) params.set("prompt", "select_account");

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return new Promise<GoogleProfile>((resolve, reject) => {
    let handle: { remove: () => void } | undefined;
    const cleanup = () => { handle?.remove?.(); };

    App.addListener("appUrlOpen", async (event: any) => {
      try {
        const u = new URL(event.url);
        if (!event.url.startsWith(ANDROID_REDIRECT_URI)) return;
        const code = u.searchParams.get("code");
        const err = u.searchParams.get("error");
        await Browser.close().catch(() => {});
        if (err) { cleanup(); return reject(new Error(err)); }
        if (!code) { cleanup(); return reject(new Error("No auth code returned")); }

        // Exchange code for token (PKCE — no client secret needed).
        const body = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: ANDROID_REDIRECT_URI,
        });
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        if (!res.ok) {
          const t = await res.text();
          cleanup(); return reject(new Error(`Token exchange failed: ${t}`));
        }
        const tok = await res.json();
        const expiresIn = Number(tok.expires_in || 3600);
        saveToken({
          access_token: tok.access_token,
          expires_at: Date.now() + (expiresIn - 60) * 1000,
        });
        const p = await fetchProfile(tok.access_token);
        saveProfile(p);
        _emitAuth();
        cleanup();
        resolve(p);
      } catch (e) { cleanup(); reject(e); }
    }).then(s => { handle = s; });

    Browser.open({ url, presentationStyle: "fullscreen" }).catch(reject);
  });
}

// ---------------- public sign-in API ----------------

export async function signIn(opts?: { selectAccount?: boolean }): Promise<GoogleProfile> {
  return isCapacitorNative() ? signInNative(opts) : signInWeb(opts);
}

export async function signOut(): Promise<void> {
  const t = loadToken();
  if (t) {
    // Best-effort revoke.
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${t.access_token}`, { method: "POST" });
    } catch {}
  }
  clearAuth();
  _emitAuth();
}

export async function getAccessToken(): Promise<string> {
  const t = loadToken();
  if (t && t.expires_at > Date.now()) return t.access_token;
  // Try silent refresh on web.
  if (!isCapacitorNative()) {
    const fresh = await refreshTokenWeb();
    if (fresh) return fresh;
  }
  throw new Error("Session expired — please sign in again.");
}

// ---------------- auth event bus ----------------

const _authListeners = new Set<() => void>();
function _emitAuth() { _authListeners.forEach(l => l()); }
export function onAuthChange(cb: () => void): () => void {
  _authListeners.add(cb);
  return () => _authListeners.delete(cb);
}

// ---------------- Drive AppData I/O ----------------

const DRIVE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const tok = await getAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${tok}`);
  return fetch(input, { ...init, headers });
}

async function findBackupFileId(): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
    fields: "files(id, name, modifiedTime)",
    pageSize: "10",
  });
  const res = await authedFetch(`${DRIVE}/files?${params.toString()}`);
  if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
  const j = await res.json();
  return j.files?.[0]?.id ?? null;
}

export type CloudBackupMeta = {
  id: string;
  modifiedTime: string;
  size: number | null;
};

export async function getBackupMeta(): Promise<CloudBackupMeta | null> {
  const id = await findBackupFileId();
  if (!id) return null;
  const res = await authedFetch(`${DRIVE}/files/${id}?fields=id,modifiedTime,size`);
  if (!res.ok) throw new Error(`Drive meta failed (${res.status})`);
  const j = await res.json();
  return { id: j.id, modifiedTime: j.modifiedTime, size: j.size ? Number(j.size) : null };
}

export async function downloadBackup(): Promise<any | null> {
  const id = await findBackupFileId();
  if (!id) return null;
  const res = await authedFetch(`${DRIVE}/files/${id}?alt=media`);
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  return await res.json();
}

export async function uploadBackup(payload: unknown): Promise<void> {
  const existingId = await findBackupFileId();
  const json = JSON.stringify(payload);

  if (existingId) {
    // Update content (PATCH multipart).
    const boundary = "hk_" + randomString(8);
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `{}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${json}\r\n` +
      `--${boundary}--`;
    const res = await authedFetch(
      `${DRIVE_UPLOAD}/files/${existingId}?uploadType=multipart&fields=id,modifiedTime`,
      {
        method: "PATCH",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!res.ok) throw new Error(`Drive update failed (${res.status}): ${await res.text()}`);
    return;
  }

  // Create new file in appDataFolder.
  const boundary = "hk_" + randomString(8);
  const metadata = { name: BACKUP_FILE_NAME, parents: ["appDataFolder"] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}--`;
  const res = await authedFetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive create failed (${res.status}): ${await res.text()}`);
}

export async function deleteBackup(): Promise<void> {
  const id = await findBackupFileId();
  if (!id) return;
  const res = await authedFetch(`${DRIVE}/files/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Drive delete failed (${res.status})`);
}
