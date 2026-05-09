# Building the Android APK (Hisaab Kitaab)

This is the **only** sequence that works on a fresh clone. Run it exactly.

## Prerequisites

- Node.js 20+
- Android Studio (Hedgehog or newer) with Android SDK 36 + JDK 21
- `ANDROID_HOME` env var set

## Build steps (every time you pull new code)

```bash
npm install
npm run android:sync     # builds the SPA AND copies it into android/app/src/main/assets/public
npm run android:verify   # sanity-checks that the bundle landed correctly
```

> WARNING: Android Studio alone will **not** rebuild the React bundle.
> If you skip `npm run android:sync` after a `git pull`, the APK will run a
> stale or missing bundle and look completely broken. Always run sync first.

Then:

```bash
npx cap open android
```

In Android Studio:

1. Wait for **Gradle Sync** to finish.
2. **Build → Clean Project**
3. **Build → Rebuild Project**
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Command-line build (no Android Studio UI)

```bash
npm run android:sync
npm run android:verify
cd android
./gradlew clean
./gradlew assembleDebug
```

## Important: uninstall the old APK first

Android caches the WebView's localStorage and IndexedDB per app id. After
big changes, **uninstall the previous version on the device** before installing
the new APK so you start from a clean slate.

## Why the preview can look fine but the APK breaks

The hosted preview runs the full Vite/SSR web app. The APK runs a separate
mobile-only static SPA bundle that lives in `dist-mobile/` and is copied into
`android/app/src/main/assets/public`. Both folders are gitignored on purpose —
they are generated artifacts. If you build an APK without first running
`npm run android:sync`, the WebView either loads nothing or loads an old build.

## Updating the launcher icon

Replace `resources/icon.png` (1024×1024, fully transparent edges) and re-run:

```bash
npm run android:sync
```
