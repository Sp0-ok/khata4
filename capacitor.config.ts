import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.hisaab.khata",
  appName: "Hisaab Kitaab",
  webDir: "dist/client",
  bundledWebRuntime: false,
  android: {
    // Use https scheme so the WebView treats the asset bundle as a secure origin —
    // IndexedDB (Dexie) only persists reliably on a secure origin.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#0d9488",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d9488",
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
  },
};

export default config;
