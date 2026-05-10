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
