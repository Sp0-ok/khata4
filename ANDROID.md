# Building the Android APK

This app is wrapped with **Capacitor**. Everything inside the APK is the same
React/TanStack app you see in the browser, served as static assets — no server,
no internet required after install. All data lives in IndexedDB on the device.

## Prerequisites (one-time, on your computer)

1. **Node + Bun** (already installed if you've run the project locally).
2. **Android Studio** — <https://developer.android.com/studio>.
   - Open it once and let it install the SDK + an emulator if you want to test
     without a phone.
3. **JDK 17** (Android Studio bundles it; if you build from CLI, set
   `JAVA_HOME` to point at it).

## First-time setup (run once per clone)

```bash
bun install
bun run android:init
```

`android:init` does:
- `bun run build` — produces the static SPA in `dist/client/`.
- `node scripts/prepare-android.mjs` — copies the SPA shell so deep links work.
- `npx cap add android` — generates the `android/` Gradle project.
- `npx cap sync android` — copies web assets + Capacitor plugins into it.

After this you have an `android/` folder. Commit it (or keep it local — your
choice).

## Iterating

After any code change:

```bash
bun run android:sync
```

This rebuilds the web app and pushes the new files into `android/`.

To open the project in Android Studio:

```bash
bun run android:open
```

Then click **Run ▶** to install on a connected device or emulator.

## Building a signed APK

In Android Studio: **Build → Generate Signed App Bundle / APK → APK**.
Follow the wizard to create a keystore (keep the `.jks` file safe — you need
it for every future update on the Play Store).

For a quick **debug APK** (not for distribution, but installable on any
device with Developer Mode):

```bash
cd android
./gradlew assembleDebug
# APK appears at: android/app/build/outputs/apk/debug/app-debug.apk
```

## Why it won't freeze on cold start

- The build is a pure SPA — no SSR fetch, no network request to boot.
- IndexedDB (Dexie) is opened lazily and the UI shows a splash until the
  database is ready (`src/lib/db-ready.ts`).
- `navigator.vibrate` and other browser-only APIs are guarded — the WebView
  on some Android versions doesn't expose them and would otherwise throw.
- All routes are preloaded after first paint, so tab switches are instant
  even on cold cache.
- Heavy modules (`jspdf`, `recharts`) are dynamically imported only when the
  user opens the screen / action that needs them.

## Troubleshooting

- **White screen on launch** → check `chrome://inspect` from your computer
  while the app is running on a USB-connected device. Look for missing
  asset 404s; usually means `prepare-android.mjs` didn't run.
- **"IndexedDB is not available"** → the WebView is in incognito or has
  storage disabled. Reinstall the APK.
- **Status bar overlapping content** → the splash plugin handles this
  automatically; if it persists, edit `capacitor.config.ts` `StatusBar`
  block.

---

## Google Drive Sync — Android setup

Hisaab Kitaab backs up data to a private folder in your **own Google Drive**
(`drive.appdata` scope — invisible in the Drive UI, only this app can read it).

On Android, sign-in uses **Google's native Sign-In SDK** via the
`@capgo/capacitor-social-login` plugin. There is **no redirect URI**
involved — Google authenticates the app using its package name + SHA-1
fingerprint registered in Google Cloud Console. This is why you saw
*"Invalid Redirect: must use either http or https"* when trying to add
`app.hisaab.khata://oauth` to a Web Client — that scheme is not (and does
not need to be) configured anywhere.

### 1. Register an Android OAuth client (REQUIRED)

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):

1. **Create Credentials → OAuth Client ID**
2. **Application type**: Android
3. **Package name**: `app.hisaab.khata`
4. **SHA-1 fingerprint**: get it with:
   ```bash
   cd android && ./gradlew signingReport
   ```
   Add the **debug** SHA-1 for development APKs and the **release** SHA-1
   (from your release keystore) before publishing.

You don't need to paste this Android client ID anywhere in code — Google
matches the package + signature automatically when the app calls Sign-In.

The Web Client ID
(`3603875681-ocr5oh6irkmig5pnl12q91mu1gqqcjr5.apps.googleusercontent.com`)
is still used as the `serverClientId` so the access token comes back scoped
to the same project; it is already wired in `capacitor.config.ts`.

The Android native callback needed for Drive scope consent is patched
automatically by `bun run android:sync`.

### 2. Make sure the Drive scope is on the OAuth consent screen

Under **APIs & Services → OAuth consent screen → Scopes**, ensure these are
added:
- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`
- `https://www.googleapis.com/auth/drive.appdata`

While the app is in **Testing** mode, add yourself (and any tester Google
accounts) under **Test users**.

### 3. Re-sync after edits

```bash
bun run android:sync
```

### How it works on Android

- Tapping **Sign in with Google** opens the native Google account picker
  (system UI, no browser tab).
- Google verifies the app via package name + SHA-1, then returns an OAuth
  access token directly to the WebView.
- All Drive API calls (`drive.appdata`) go straight from the WebView using
  that token — no Lovable / Supabase server in the loop.
