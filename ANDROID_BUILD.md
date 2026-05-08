# Building the Android app

The project is configured with Capacitor. The Android platform lives in `/android`
and the uploaded icon has been baked into all density buckets and the adaptive icon.

## One-time setup (on your machine)

1. Install Android Studio (includes the Android SDK and JDK 17).
2. Clone/export this project locally.
3. From the project root run:

   ```bash
   npm install
   npm run android:sync   # builds the SPA into dist-mobile/ and runs cap sync
   ```

> The Android WebView needs a plain static bundle, so we use a separate
> `npm run build:mobile` (configured in `vite.config.mobile.ts`) that outputs
> to `dist-mobile/index.html`. The regular `npm run build` is for the
> Cloudflare-hosted web preview and is **not** what Capacitor consumes.

## Open in Android Studio

```bash
npm run android:open
```

Then press **Run** to install on a connected device, or **Build → Generate Signed Bundle / APK** for a release build.

## Updating the icon

Replace `resources/icon.png` (1024×1024) and re-run:

```bash
npx capacitor-assets generate --android --iconBackgroundColor "#0f766e"
npm run android:sync
```

## Where do downloads go?

On Android, Statements / Invoices / Backups / CSV exports are written through
Capacitor Filesystem to **`Khata/`** under the device's Documents (or external
storage where available). Most file managers list it under
`Internal storage → Documents → Khata` or `Internal storage → Khata`.

On the web, downloads continue to use the browser save dialog.
