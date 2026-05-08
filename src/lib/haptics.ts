// Tiny vibration helper. No-op on unsupported devices.
export function haptic(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

export const tapLight = () => haptic(8);
export const tapMedium = () => haptic(15);
export const tapSuccess = () => haptic([10, 30, 18]);
export const tapWarn = () => haptic([20, 40, 20]);
