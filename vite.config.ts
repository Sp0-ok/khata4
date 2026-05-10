// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// SPA mode: TanStack emits a client-only shell at "/" so any deep link
// (including the dynamic /customers/$id routes) resolves through the
// client router — required for the Capacitor Android build, which serves
// dist/client as static files inside the WebView.
export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
      maskPath: "/",
    },
  },
});
