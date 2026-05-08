import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ensureSettings, updateSettings } from "./db";

type Theme = "light" | "dark" | "system";
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Read-only liveQuery — safe.
  const settings = useLiveQuery(() => db.settings.toArray().then(r => r[0]), []);
  const [theme, setThemeState] = useState<Theme>("system");
  const [bootstrapped, setBootstrapped] = useState(false);

  // One-time write at boot (outside liveQuery context).
  useEffect(() => {
    ensureSettings().then(() => setBootstrapped(true));
  }, []);

  useEffect(() => {
    if (settings?.theme) setThemeState(settings.theme);
  }, [settings?.theme]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const isDark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    void updateSettings({ theme: t });
  };

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{bootstrapped ? children : null}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
