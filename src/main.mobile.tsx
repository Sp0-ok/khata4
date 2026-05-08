import { StrictMode, useEffect } from "react";
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

      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        const show = await Keyboard.addListener("keyboardWillShow", (info) => {
          document.documentElement.style.setProperty("--kb-height", `${info.keyboardHeight}px`);
        });
        const hide = await Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.style.setProperty("--kb-height", `0px`);
        });
        cleanups.push(() => { show.remove(); hide.remove(); });
      } catch {
        /* ignore */
      }
    })();

    return () => { cleanups.forEach((c) => c()); };
  }, []);

  return <RouterProvider router={router} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
);
