import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

function MobileApp() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanups: Array<() => void> = [];

    // Hardware back button → router back, exit at root.
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const sub = await App.addListener("backButton", () => {
          if (window.history.length > 1) window.history.back();
          else App.exitApp();
        });
        cleanups.push(() => sub.remove());
      } catch {
        /* ignore */
      }
    })();

    return () => { cleanups.forEach((c) => c()); };
  }, []);

  return <RouterProvider router={router} />;
}

createRoot(document.getElementById("root")!).render(<MobileApp />);
