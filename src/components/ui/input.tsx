import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, pattern, ...props }, ref) => {
    // Android WebView (especially older System WebView versions) often ignores
    // the `inputmode` attribute and falls back to a full QWERTY keyboard for
    // `type="text"`. To guarantee the numeric IME on the built APK, we
    // translate `inputMode="decimal" | "numeric"` to `type="tel"` (which
    // *always* triggers a numeric IME on Android regardless of WebView
    // version). `type="tel"` accepts any character in the value, so existing
    // formatted amount strings (with commas / dots) still display correctly.
    const wantsNumericIME = inputMode === "decimal" || inputMode === "numeric" || type === "number";
    const isTel = type === "tel";
    const resolvedType = wantsNumericIME ? "tel" : type;
    const resolvedInputMode =
      inputMode ?? (type === "number" ? "decimal" : isTel ? "tel" : undefined);
    const resolvedPattern =
      pattern ?? (wantsNumericIME ? "[0-9]*[.,]?[0-9]*" : isTel ? "[0-9+ ()-]*" : undefined);
    return (
      <input
        type={resolvedType}
        inputMode={resolvedInputMode}
        pattern={resolvedPattern}
        autoCapitalize={wantsNumericIME || isTel ? "off" : props.autoCapitalize}
        autoCorrect={wantsNumericIME || isTel ? "off" : (props as any).autoCorrect}
        spellCheck={wantsNumericIME || isTel ? false : props.spellCheck}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
