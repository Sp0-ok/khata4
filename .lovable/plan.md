## Plan

1. **Add missing confirmation before editing entries**
   - Add an AlertDialog around the transaction edit action so tapping the pencil first asks for confirmation before opening the edit screen.
   - Keep the existing delete confirmation untouched.

2. **Make the app Capacitor Android build ready**
   - Add Capacitor dependencies and config for Android.
   - Configure the app id/name, web output directory, and Android platform folder.
   - Add native-safe build settings so the bundled web app can run inside Android WebView.

3. **Apply the uploaded image as the Android app icon**
   - Copy the uploaded icon into the project assets.
   - Generate Android icon densities/adaptive icon resources from it.
   - Wire the generated icon into the Android project so APK/AAB builds use it.

4. **Make downloads work properly on Android**
   - Add a small native download helper that detects Capacitor.
   - For statements, invoices, backups, and CSV exports: save files through native filesystem APIs on Android instead of relying on browser `a.download` / `doc.save()`.
   - Prefer `Downloads/Khata` when supported by the Android filesystem API; otherwise save to an app-accessible Documents/Khata folder and show a clear success message with the location.
   - Keep normal browser downloads working in preview/web.

5. **Fix the first-click / route-load lag**
   - Remove heavy route-level eager imports where they hurt first navigation, especially `framer-motion` animations on list screens and charts/report dependencies being pulled into the main route tree too early.
   - Replace expensive list layout animations with lightweight CSS transitions on high-use screens like Parties, Expenses, Invoices, and Party Detail.
   - Lazy-load heavy PDF generation code only when the user taps PDF/Statement.
   - Remove external Google font loading from the app shell and rely on fast system font fallbacks to improve cold start and Android WebView startup.
   - Change navigation preloading from hover/intent to a more mobile-friendly strategy so tapping bottom nav doesn’t trigger unnecessary work before navigation.

6. **Validate**
   - Re-profile the same mobile-size navigation path after changes and check that first route interaction no longer produces the 5-second delay.
   - Verify the web app still renders and the download functions still have browser fallbacks.
   - Confirm Android project files and icon resources exist and are ready for `npx cap sync android` / Android Studio builds.