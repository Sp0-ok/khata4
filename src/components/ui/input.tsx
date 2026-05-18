import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, pattern, ...props }, ref) => {
    // Keyboard hint mapping for Android WebView.
    //
    // Modern Android WebView (Chrome 66+, i.e. anything since 2018) honors the
    // `inputmode` attribute and shows the matching software keyboard. Crucially,
    // `inputmode="decimal"` gives the calculator-style numeric pad WITH a
    // decimal point — what amount fields need. `type="tel"` would force the
    // phone dialpad (digits + * #) which has NO decimal point on Gboard, so we
    // do not coerce decimal inputs into `tel`.
    //
    // Rules:
    //  - type="number"  → keep, also set inputmode="decimal" for safety.
    //  - type="tel"     → keep (phone fields want the dialpad).
    //  - inputMode set  → pass through unchanged; type defaults to "text".
    const isPhone = type === "tel" || inputMode === "tel";
    const wantsNumeric =
      type === "number" ||
      inputMode === "decimal" ||
      inputMode === "numeric";

    const resolvedType = type ?? (isPhone ? "tel" : "text");
    const resolvedInputMode =
      inputMode ?? (type === "number" ? "decimal" : isPhone ? "tel" : undefined);
    const resolvedPattern =
      pattern ?? (wantsNumeric ? "[0-9]*[.,]?[0-9]*" : isPhone ? "[0-9+ ()-]*" : undefined);

    return (
      <input
        type={resolvedType}
        inputMode={resolvedInputMode}
        pattern={resolvedPattern}
        autoCapitalize={wantsNumeric || isPhone ? "off" : props.autoCapitalize}
        autoCorrect={wantsNumeric || isPhone ? "off" : (props as any).autoCorrect}
        spellCheck={wantsNumeric || isPhone ? false : props.spellCheck}
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
