// Google OAuth Web Client ID — public value, safe to ship in the bundle.
// Created in Google Cloud Console → APIs & Services → Credentials.
export const GOOGLE_CLIENT_ID =
  "3603875681-ocr5oh6irkmig5pnl12q91mu1gqqcjr5.apps.googleusercontent.com";

// Scope for the hidden, per-app Drive folder. Files there are visible only to
// this OAuth client — the user can't see them in Drive UI, other apps can't read them.
export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
export const PROFILE_SCOPES = "openid email profile";
export const FULL_SCOPES = `${PROFILE_SCOPES} ${DRIVE_APPDATA_SCOPE}`;

// File name used inside Drive's appDataFolder.
export const BACKUP_FILE_NAME = "hisaab-kitaab-backup.json";

// Custom scheme registered on Android for OAuth deep-links back into the app.
// Configured via capacitor.config.ts and AndroidManifest intent-filter.
export const ANDROID_REDIRECT_SCHEME = "app.hisaab.khata";
export const ANDROID_REDIRECT_URI = `${ANDROID_REDIRECT_SCHEME}://oauth`;
