import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Standalone client-only SPA build for Capacitor / Android.
// Does NOT use the TanStack Start or Cloudflare Worker plugin — output is
// plain static HTML/JS/CSS the Android WebView can load from `dist-mobile/`.
//
// IMPORTANT: We disable per-route code splitting here. On low-end Android
// devices each navigation otherwise triggers a network-style chunk fetch +
// parse + compile that the user perceives as a "freeze" for a few seconds.
// One bigger bundle parses once at startup and every navigation is instant.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Relative base so the Android WebView can load assets from
  // file:///android_asset/public/index.html without root-path lookups.
  base: "./",
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
    target: "es2020",
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, "index.mobile.html"),
      output: {
        // Single app chunk — keeps navigation instant on Android WebView.
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
});
