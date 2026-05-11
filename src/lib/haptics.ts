// Tiny vibration helper. Uses Capacitor Haptics on Android, falls back to
// navigator.vibrate on the web, and silently no-ops where neither exists.
// All work is deferred so the first call doesn't block the UI thread.

let capPromise: Promise<typeof import("@capacitor/haptics") | null> | null = null;
async function getCap() {
  if (typeof window === "undefined") return null;
  if (!capPromise) {
    capPromise = import("@capacitor/haptics").catch(() => null);
  }
  return capPromise;
}

function webVibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

export function haptic(pattern: number | number[] = 10) {
  // Always fire the web fallback synchronously — it's free on devices that
  // support it. Then layer Capacitor on top for native APK installs.
  webVibrate(pattern);
  void getCap().then((mod) => {
    if (!mod) return;
    try {
      const cap = (window as any).Capacitor;
      if (!cap?.isNativePlatform?.()) return;
      const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
      const style = ms < 12 ? mod.ImpactStyle.Light : ms < 25 ? mod.ImpactStyle.Medium : mod.ImpactStyle.Heavy;
      void mod.Haptics.impact({ style }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  });
}

export const tapLight = () => haptic(8);
export const tapMedium = () => haptic(15);
export const tapSuccess = () => haptic([10, 30, 18]);
export const tapWarn = () => haptic([20, 40, 20]);
