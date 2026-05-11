
# Google Account Sync — Backup & Restore

Add a "Sign in with Google" option so all data (parties, transactions, invoices, expenses, settings — **excluding images**) is automatically backed up to the cloud and can be restored on a fresh install by signing back in.

## How it will work for the user

1. **Settings → Account** section
   - Signed out: a "Sign in with Google" button
   - Signed in: shows Google avatar + email, with **Sync now**, **Switch account**, and **Sign out** buttons. A small line shows "Last synced 2 min ago".
2. **First sign-in on a new device**
   - If cloud has data → prompt: "Restore backup from {email}? This will replace data on this device." (Yes / No)
   - If cloud is empty → uploads current local data as the initial backup.
3. **Auto-sync** runs:
   - On app open (when signed in)
   - After every create/update/delete (debounced ~3 s) for parties, transactions, invoices, expenses, settings
4. **Manual sync** button always available; shows toast on success/failure.
5. **Offline-friendly**: app keeps working offline; sync resumes when network returns. Local IndexedDB stays the source of truth on-device.

## Conflict rule (since this is backup & restore, not multi-device merge)

- Each backup row stores a `deviceId` + `updatedAt` timestamp.
- On app open, if cloud `updatedAt` is **newer** than local last-sync marker AND from a **different device**, show a one-time prompt: "Cloud backup is newer (from {device}, {date}). Restore?" — Yes overwrites local; No overwrites cloud on next push.
- Same device → silent push.
- This avoids accidental data loss without doing real merge.

## What gets synced

Included: `parties`, `transactions`, `invoices`, `expenses`, `settings` (minus `logo`).
Excluded: any image fields (`photo` on transactions/expenses, `logo` in settings) — stripped before upload.

## Technical implementation

### 1. Backend (Lovable Cloud / Supabase)
- Enable Lovable Cloud.
- Enable **Google** auth provider (managed, zero setup).
- Create one table `backups`:
  ```
  user_id uuid PK references auth.users on delete cascade
  payload jsonb           -- the full data dump (no images)
  device_id text
  device_name text
  updated_at timestamptz
  size_bytes int
  ```
- RLS: user can only `select`/`insert`/`update`/`delete` their own row.
- Single row per user (upsert on `user_id`).

### 2. Auth client
- Add `src/integrations/supabase/client.ts` (already provided when Cloud is enabled).
- New hook `src/lib/auth.ts`:
  - `useAuthUser()` → reactive current user
  - `signInWithGoogle()` → `supabase.auth.signInWithOAuth({ provider: 'google' })` with mobile-friendly redirect (Capacitor deep link `app.hisaab.khata://auth-callback` on Android, `window.location.origin` on web).
  - `signOut()`, `switchAccount()` (sign out then sign in).
- For Android (Capacitor), use `@capacitor/browser` + `App` URL listener to capture the OAuth redirect and call `supabase.auth.exchangeCodeForSession`.

### 3. Sync engine — `src/lib/sync.ts`
- `buildSnapshot()`: reads all Dexie tables, strips `photo`/`logo`, returns JSON.
- `applySnapshot(json)`: inside one `db.transaction("rw", ...)`, clears tables and bulk-inserts (same remap pattern as the existing JSON import in `settings.tsx`).
- `pushSync()`: builds snapshot → upserts row in `backups` with new `updated_at` + this device's id (random UUID stored in localStorage) + name (from Capacitor `Device.getInfo()`).
- `pullSync()`: fetches row, returns payload.
- `syncNow()`: pull → compare timestamps → push or restore based on rule above.
- `useAutoSync()`: hook that
  - calls `syncNow()` on mount when signed in
  - subscribes to Dexie `db.on('changes')` (or wraps mutations) and debounces a `pushSync()` call by 3 s
  - shows subtle status (idle / syncing / synced / error) via a small store

### 4. UI
- New `<AccountCard>` in `src/routes/settings.tsx` (placed at the top, above Business). States:
  - **Signed out**: button "Sign in with Google" + one-line explainer "Auto-backup so you never lose your data."
  - **Signed in**: avatar, name, email, last-synced text, buttons: Sync now, Switch account, Sign out (with confirm dialog explaining local data stays).
- Tiny sync indicator in `PageHeader` (cloud icon) on Home — green tick / spinner / red bang.
- First-launch restore dialog uses existing `AlertDialog`.

### 5. Capacitor config
- Add `@capacitor/browser` + URL scheme `app.hisaab.khata` to `capacitor.config.ts` and Android `AndroidManifest.xml` (handled by `cap sync` after declaring `appUrlOpen`).
- Document the new redirect URI to whitelist in Lovable Cloud → Auth → URL configuration.

### 6. Files to add / change

```text
Add:
  src/lib/auth.ts
  src/lib/sync.ts
  src/components/AccountCard.tsx
  src/components/SyncIndicator.tsx
  supabase migration: backups table + RLS

Edit:
  src/routes/settings.tsx        (mount AccountCard, remove duplicate JSON-import note)
  src/routes/__root.tsx          (mount useAutoSync, OAuth deep-link listener)
  src/components/AppShell.tsx    (PageHeader gets optional SyncIndicator)
  capacitor.config.ts            (deep link scheme)
```

### 7. Limits & notes
- Backup row capped at ~1 MB JSON (jsonb soft-cap warning at 800 KB → toast "Backup is large, consider clearing old data"). With no images, even thousands of txns stay well under this.
- Existing local "Full backup (JSON)" and "Restore backup" buttons stay — they remain the export-to-file path.
- Clear-all-data does NOT touch the cloud; user must explicitly Sign out or use a separate "Delete cloud backup" button (added next to Sign out).

## Out of scope (per your answers)
- Multi-device live sync / merge
- Image / logo / receipt sync
- Other providers (Apple, email-password)
