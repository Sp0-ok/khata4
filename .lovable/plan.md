## Problem

`npx cap sync android` fails with:

```
The web assets directory (./dist) must contain an index.html file.
```

This app is built on TanStack Start with the Cloudflare Worker plugin. Its `vite build` output is an SSR bundle (server worker + client assets in `dist/client`) — there is no top-level `dist/index.html`, so Capacitor (which only ships static web assets into the Android WebView) has nothing to load.

The npm warnings shown above the error are just deprecation notices from transitive dependencies — they are not failures and don't need to be fixed for the Android build to work. The only real blocker is the missing `index.html`.

The app's data layer (Dexie/IndexedDB) is fully client-side, so the app does not need SSR on Android — a plain SPA shell is enough.

## Plan

1. **Add a mobile-only static SPA build**
   - Add a small dedicated Vite config (e.g. `vite.config.mobile.ts`) that does **not** use the TanStack Start / Cloudflare Worker plugin and instead builds a normal client-only React app.
   - Use TanStack Router's memory/file-based routing in client-only mode, mounted from a small `src/main.mobile.tsx` entry that renders `<RouterProvider router={getRouter()} />` into `#root`.
   - Add a static `index.mobile.html` (becomes `dist-mobile/index.html`) that loads that entry.
   - Output to `dist-mobile/` so it doesn't collide with the Worker build in `dist/`.

2. **Wire Capacitor to the new output**
   - Change `capacitor.config.ts` `webDir` from `"dist"` to `"dist-mobile"`.
   - Add npm scripts:
     - `build:mobile` → `vite build --config vite.config.mobile.ts`
     - `android:sync` → `npm run build:mobile && npx cap sync android`
     - `android:open` → `npm run android:sync && npx cap open android`
   - Update `ANDROID_BUILD.md` so the documented commands match (`npm run android:sync` instead of `npm run build && npx cap sync android`).

3. **Make the existing root route SPA-safe**
   - `src/routes/__root.tsx` currently renders the full `<html><body>` shell via `shellComponent` for SSR. For the mobile build, the static `index.html` already provides that shell, so the SPA entry will mount only `RootComponent` (which renders `<Outlet />` + providers). No edits to route files are required — only the entry chooses what to render.
   - Verify nothing in the route tree imports server-only modules at module scope (`*.server.ts`, server functions). If any do, move those imports inside event handlers so the mobile bundle stays clean.

4. **Validate**
   - Run `npm run build:mobile` and confirm `dist-mobile/index.html` plus hashed JS/CSS assets exist.
   - Run `npx cap sync android` and confirm it copies assets without the previous error.
   - Sanity check the SPA in a browser by serving `dist-mobile/` (e.g. `npx serve dist-mobile`) so onboarding, parties, statements, and downloads all work before pushing to a device.
   - Leave the existing web/Cloudflare build (`npm run build`) untouched so the hosted preview keeps working.

## Notes on the npm warnings

The deprecation warnings (`q`, `uuid@7`, `tar@6`, `glob@9`, `prebuild-install`, etc.) come from build-time transitive dependencies of `@capacitor/assets` and similar tooling. They do not affect the Android app at runtime and are out of scope for this fix; npm `audit` highs can be revisited separately if you want.
