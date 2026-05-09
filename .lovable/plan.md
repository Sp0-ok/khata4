## What’s actually wrong

The preview and APK are not running the same app artifact.

- The preview runs the normal web/dev build.
- The APK runs the static Capacitor bundle copied into `android/app/src/main/assets/public`.
- That copied Android asset folder is ignored by git, so a clean clone can easily build stale/missing/native assets unless `npm run android:sync` is run exactly before opening/building Android Studio.
- The current Android HTML also references assets with root paths like `/assets/...`. That can work in hosted preview, but it is fragile inside the Android WebView asset server and can produce “doesn’t load” behavior.
- The Android theme/layout still uses AppCompat/DayNight and `adjustPan`, which can fight WebView dark mode + keyboard resizing. That matches your symptoms: dark mode blank/load failure, freezes on text fields, and random tap crashes.

Do I know what the issue is? Yes: the APK is loading a different, fragile Capacitor static bundle under an Android theme/keyboard setup that does not match the preview runtime.

## Fix plan

1. **Create one Android-safe runtime path**
   - Keep the hosted web preview untouched.
   - Make the mobile build produce APK-safe `index.html` with relative asset paths (`./assets/...`) instead of root `/assets/...`.
   - Add a local “mobile preview” command so you can test the exact APK bundle in a browser before Android Studio.

2. **Stop committing/generated-stale APK web assets from misleading builds**
   - Remove generated `dist-mobile/` and `android/app/src/main/assets/public` from source control if present.
   - Keep them ignored.
   - Make docs and scripts impossible to misread: every APK build must run `npm run android:sync` first.
   - Add a verification script that checks the Android asset `index.html` exists and points to current relative JS/CSS files.

3. **Stabilize Android WebView theme + dark mode**
   - Change native Android activity theme to a plain light, no-actionbar, non-DayNight WebView container.
   - Disable Android force-dark at the native theme level so the system does not invert/blank the WebView.
   - Keep app-controlled light/dark mode inside React only.
   - Align splash/background color with the restored non-teal app background.

4. **Fix keyboard-related freezes**
   - Replace `adjustPan` with the safer WebView keyboard behavior (`adjustResize`) and ensure the activity handles keyboard config changes cleanly.
   - Add Android-specific CSS for `html/body/#root` using stable viewport sizing and touch handling.
   - Remove global transition/animation-heavy behavior from basic buttons/inputs on Android where it can cause WebView jank.

5. **Reduce tap crash sources**
   - Simplify native back-button behavior so it uses router history safely and does not exit unexpectedly during normal navigation.
   - Remove fragile long-press/touch/mouse overlap on the Settings easter egg and implement it with pointer events only.
   - Audit Settings, Reports, BottomNav, onboarding buttons, inputs, and sheet triggers for invalid nested buttons or pointer handlers that can lock touch state.

6. **Make Android Studio build flow deterministic**
   - Update `ANDROID_BUILD.md` with the exact clean-clone sequence:
     - `npm install`
     - `npm run android:sync`
     - open Android Studio
     - Gradle sync
     - Build APK
   - Add a warning that Android Studio alone will not rebuild/copy the React bundle unless `android:sync` was run first.

7. **Validation before handing back**
   - Run the mobile build/sync verification command.
   - Inspect the generated Android `public/index.html` for relative assets.
   - Confirm the native Android config files no longer use DayNight/force-dark/fragile keyboard settings.

## Expected outcome

After this, the preview will still be the web app, but the APK will be built from a stable Android-specific bundle with predictable assets, dark mode controlled only by the app, and keyboard/tap handling designed for Android WebView.