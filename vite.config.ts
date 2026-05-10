// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Bun's process.stdin behaves slightly differently from Node's; Vite's
// SIGTERM teardown wires `process.stdin.on('end', ...)` and later calls
// `.off(...)` on it during prerender cleanup, which can crash under Bun.
// Setting CI=true makes Vite skip the stdin listener entirely.
if (!process.env.CI) process.env.CI = "true";

// SPA mode: TanStack emits a client-only shell at "/" so any deep link
// (including the dynamic /customers/$id routes) resolves through the
// client router — required for the Capacitor Android build, which serves
// dist/client as static files inside the WebView.
//
// The Cloudflare Vite plugin always names the worker bundle `index.js`,
// but TanStack's prerender preview server (used during `vite build`)
// expects `<server-entry>.js` (default: `server.js`). We bridge the gap
// by aliasing index.js → server.js in dist/server right after the server
// bundle is written, so the prerender step can boot it.
export default defineConfig({
  tanstackStart: {
    spa: { enabled: true, maskPath: "/" },
  },
  vite: {
    plugins: [
      {
        name: "alias-cf-worker-as-server-js",
        apply: "build",
        writeBundle(options) {
          const dir = options.dir;
          if (!dir) return;
          const src = resolve(dir, "index.js");
          const dest = resolve(dir, "server.js");
          if (existsSync(src) && !existsSync(dest)) {
            try {
              copyFileSync(src, dest);
            } catch {
              // best effort — only matters for the prerender preview step
            }
          }
        },
      },
    ],
  },
});
