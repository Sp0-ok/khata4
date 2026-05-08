# Building the Android app

The project is configured with Capacitor. The Android platform lives in `/android`
and the uploaded icon has been baked into all density buckets and the adaptive icon.

## One-time setup (on your machine)

1. Install Android Studio (includes the Android SDK and JDK 17).
2. Clone/export this project locally.
3. From the project root run:

   ```bash
   npm install
   npm run build           # produces /dist
   npx cap sync android    # copies the latest web build into android/
   ```

## Open in Android Studio

```bash
npx cap open android
```

Then press **Run** to install on a connected device, or **Build → Generate Signed Bundle / APK** for a release build.

## Updating the icon

Replace `resources/icon.png` (1024×1024) and re-run:

```bash
npx capacitor-assets generate --android --iconBackgroundColor "#0f766e"
npx cap sync android
```

## Where do downloads go?

On Android, Statements / Invoices / Backups / CSV exports are written through
Capacitor Filesystem to **`Khata/`** under the device's Documents (or external
storage where available). Most file managers list it under
`Internal storage → Documents → Khata` or `Internal storage → Khata`.

On the web, downloads continue to use the browser save dialog.
</content>
