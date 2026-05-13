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
    GoogleAuth: {
      // Use the WEB client ID as serverClientId — Android picks up its own
      // OAuth client automatically via package name + SHA-1 fingerprint
      // registered in Google Cloud Console.
      clientId: "3603875681-ocr5oh6irkmig5pnl12q91mu1gqqcjr5.apps.googleusercontent.com",
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.appdata",
      ],
      grantOfflineAccess: true,
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
