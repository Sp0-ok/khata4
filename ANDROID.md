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

The Web Client ID (`3603875681-ocr5oh6irkmig5pnl12q91mu1gqqcjr5...`) is already
wired in `src/lib/google-config.ts`. For Android you also need to:

### 1. Add the OAuth redirect intent-filter

Open `android/app/src/main/AndroidManifest.xml` and add this **inside** the
existing `<activity android:name=".MainActivity" ...>` block (after the
existing `<intent-filter>` for `MAIN`/`LAUNCHER`):

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="app.hisaab.khata" android:host="oauth" />
</intent-filter>
```

This lets Google's OAuth redirect (`app.hisaab.khata://oauth?code=...`)
re-open the app after the user signs in.

### 2. Register the Android OAuth client (recommended)

The Web Client ID works inside the system browser fine, but for Play Store
release you should **also** create an "Android" OAuth client in Google Cloud
Console:

- **Application type**: Android
- **Package name**: `app.hisaab.khata`
- **SHA-1 fingerprint**: run `cd android && ./gradlew signingReport` and
  copy the `SHA1:` from the `release` (or `debug` for testing) variant.

Add it under the same OAuth consent screen — no extra code change needed;
Google will automatically allow the package + signature combo.

### 3. Re-sync after edits

```bash
bun run android:sync
```

### How it works on Android

- Tapping **Sign in with Google** opens Chrome Custom Tabs (via
  `@capacitor/browser`) at `accounts.google.com/o/oauth2/v2/auth?...`.
- After consent, Google redirects to `app.hisaab.khata://oauth?code=...`.
- Android routes that intent back to the app; `@capacitor/app`'s
  `appUrlOpen` listener catches it, exchanges the PKCE code for a token,
  and stores it in IndexedDB-adjacent localStorage.
- All subsequent Drive API calls go straight from the WebView — no Lovable
  / Supabase server in the loop.
