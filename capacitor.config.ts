import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.hisaabkitaab",
  appName: "Hisaab Kitaab",
  webDir: "dist-mobile",
  android: {
    allowMixedContent: false,
    // Keep the WebView snappy — disable hardware backstack quirks and use
    // the modern scheme so IndexedDB/localStorage are persisted reliably.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    Keyboard: {
      // "none" prevents the WebView from re-laying out the entire app every
      // time the soft keyboard opens — that re-layout is what was causing
      // the "freeze" when tapping any text field.
      resize: "none" as any,
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: "#0d9488",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
