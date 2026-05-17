// Google Identity Services + Drive AppData client.
// - Web: GIS token client (popup) for sign-in & token refresh.
// - Capacitor (Android): native Google Sign-In via
//   @capgo/capacitor-social-login (no redirect URI involved).
//
// Tokens are kept in-memory + localStorage. Web refresh uses GIS prompt:"";
// native refresh asks the plugin for its current authorization token.

import {
  GOOGLE_CLIENT_ID,
  FULL_SCOPES,
  DRIVE_APPDATA_SCOPE,
  BACKUP_FILE_NAME,
} from "./google-config";

const TOKEN_KEY = "hk_google_token";
const PROFILE_KEY = "hk_google_profile";

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
  } catch {
    return null;
  }
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
  } catch {
    return null;
  }
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
  try {
    localStorage.removeItem("hk_pkce_verifier");
  } catch {}
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
        } catch (e) {
          reject(e);
        }
      },
      error_callback: (err: any) => reject(new Error(err?.message || "Sign-in cancelled")),
    });
    client.requestAccessToken();
  });
}

async function refreshTokenWeb(): Promise<string | null> {
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
  } catch {
    return null;
  }
}

// ---------------- native sign-in (Capgo Social Login plugin) ----------------
//
// Uses Google's native Android Sign-In SDK via @capgo/capacitor-social-login.
// No redirect URI is involved — Google authenticates the app with the Web
// Client ID plus the Android OAuth client registered for package + SHA-1.

function randomString(n: number): string {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => ("0" + b.toString(16)).slice(-2)).join("");
}

let _socialLoginInitialized = false;
let _nativeRefreshPromise: Promise<string | null> | null = null;
const GOOGLE_SCOPES = ["openid", "email", "profile", DRIVE_APPDATA_SCOPE];

type NativeLoginOptions = {
  provider: "google";
  options?: Record<string, unknown>;
};

type SocialLoginApi = {
  initialize: (options: { google: { webClientId: string } }) => Promise<void>;
  login: (options: NativeLoginOptions) => Promise<unknown>;
  refresh: (options: NativeLoginOptions) => Promise<void>;
  getAuthorizationCode: (options: { provider: "google" }) => Promise<unknown>;
  logout: (options: { provider: "google" }) => Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractNativeAccessToken(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const record = result as Record<string, unknown>;
  const accessToken = record.accessToken;
  if (accessToken && typeof accessToken === "object") {
    const token = (accessToken as Record<string, unknown>).token;
    if (typeof token === "string") return token;
  }
  if (typeof accessToken === "string") return accessToken;
  return typeof record.access_token === "string" ? record.access_token : undefined;
}

function saveNativeAccessToken(accessToken: string) {
  saveToken({
    access_token: accessToken,
    expires_at: Date.now() + 55 * 60 * 1000,
  });
}

async function getSocialLogin() {
  const mod = await import("@capgo/capacitor-social-login");
  const SocialLogin = (mod as { SocialLogin: SocialLoginApi }).SocialLogin;
  if (!_socialLoginInitialized) {
    await SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_CLIENT_ID,
      },
    });
    _socialLoginInitialized = true;
  }
  return SocialLogin;
}

async function signInNative(opts?: { selectAccount?: boolean }): Promise<GoogleProfile> {
  const SocialLogin = await getSocialLogin();
  if (opts?.selectAccount) {
    try {
      await SocialLogin.logout({ provider: "google" });
    } catch {
      // Ignore stale native sessions before explicit account switching.
    }
  }
  const login = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: GOOGLE_SCOPES,
      style: "standard",
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
    },
  });
  const result = asRecord(login)?.result;
  const accessToken = extractNativeAccessToken(result);
  if (!accessToken) throw new Error("Google Sign-In returned no access token");
  saveNativeAccessToken(accessToken);
  const profile = asRecord(asRecord(result)?.profile) || {};
  const p: GoogleProfile = {
    email: profile.email,
    name: profile.name,
    picture: profile.imageUrl,
    sub: profile.id,
  };
  saveProfile(p);
  _emitAuth();
  return p;
}

async function refreshTokenNative(): Promise<string | null> {
  if (_nativeRefreshPromise) return _nativeRefreshPromise;
  _nativeRefreshPromise = refreshTokenNativeOnce().finally(() => {
    _nativeRefreshPromise = null;
  });
  return _nativeRefreshPromise;
}

async function refreshTokenNativeOnce(): Promise<string | null> {
  try {
    const SocialLogin = await getSocialLogin();
    await SocialLogin.refresh({
      provider: "google",
      options: { scopes: GOOGLE_SCOPES },
    });
    const r = await SocialLogin.getAuthorizationCode({ provider: "google" });
    const accessToken = extractNativeAccessToken(r);
    if (!accessToken) throw new Error("Refresh returned no access token");
    saveNativeAccessToken(accessToken);
    return accessToken;
  } catch {
    // Fall back to a silent authorized-account login below.
  }

  // The native plugin can lose its cached ID token while Google still has an
  // authorized account on the device. Ask Credential Manager for an already
  // authorized Google account so Drive gets a fresh access token without the
  // user manually signing in again.
  try {
    const SocialLogin = await getSocialLogin();
    const login = await SocialLogin.login({
      provider: "google",
      options: {
        scopes: GOOGLE_SCOPES,
        style: "bottom",
        filterByAuthorizedAccounts: true,
        autoSelectEnabled: true,
      },
    });
    const result = asRecord(login)?.result;
    const accessToken = extractNativeAccessToken(result);
    if (!accessToken) return null;
    saveNativeAccessToken(accessToken);

    const profile = asRecord(asRecord(result)?.profile);
    if (typeof profile?.email === "string") {
      saveProfile({
        email: profile.email,
        name: typeof profile.name === "string" ? profile.name : undefined,
        picture: typeof profile.imageUrl === "string" ? profile.imageUrl : undefined,
        sub: typeof profile.id === "string" ? profile.id : undefined,
      });
      _emitAuth();
    }
    return accessToken;
  } catch {
    return null;
  }
}

async function signOutNative(): Promise<void> {
  try {
    const SocialLogin = await getSocialLogin();
    await SocialLogin.logout({ provider: "google" });
  } catch {
    // Local auth state is cleared by the caller even if native logout fails.
  }
}

// ---------------- public sign-in API ----------------

export async function signIn(opts?: { selectAccount?: boolean }): Promise<GoogleProfile> {
  return isCapacitorNative() ? signInNative(opts) : signInWeb(opts);
}

export async function signOut(): Promise<void> {
  const t = loadToken();
  if (isCapacitorNative()) {
    await signOutNative();
  } else if (t) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${t.access_token}`, {
        method: "POST",
      });
    } catch {}
  }
  clearAuth();
  _emitAuth();
}

export async function getAccessToken(): Promise<string> {
  const t = loadToken();
  if (t && t.expires_at > Date.now()) return t.access_token;
  if (isCapacitorNative()) {
    const fresh = await refreshTokenNative();
    if (fresh) return fresh;
  } else {
    const fresh = await refreshTokenWeb();
    if (fresh) return fresh;
  }
  throw new Error("Session expired — please sign in again.");
}

// ---------------- auth event bus ----------------

const _authListeners = new Set<() => void>();
function _emitAuth() {
  _authListeners.forEach((l) => l());
}
export function onAuthChange(cb: () => void): () => void {
  _authListeners.add(cb);
  return () => _authListeners.delete(cb);
}

// ---------------- Drive AppData I/O ----------------

const DRIVE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (token: string) => {
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
  let tok = await getAccessToken();
  let res = await doFetch(tok);
  if (res.status === 401) {
    // Token rejected — force refresh and retry once.
    saveToken(null);
    const fresh = isCapacitorNative() ? await refreshTokenNative() : await refreshTokenWeb();
    if (fresh) res = await doFetch(fresh);
  }
  return res;
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
