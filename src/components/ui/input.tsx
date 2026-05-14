import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, inputMode, pattern, ...props }, ref) => {
    // Android WebView doesn't reliably show the numpad for `type="number"`
    // unless `inputMode` is explicitly set. Map number/tel to the appropriate
    // mobile keypad hints so number-only fields always get the numpad.
    const isNumber = type === "number";
    const isTel = type === "tel";
    const resolvedInputMode =
      inputMode ?? (isNumber ? "decimal" : isTel ? "tel" : undefined);
    const resolvedPattern =
      pattern ?? (isNumber ? "[0-9]*[.,]?[0-9]*" : isTel ? "[0-9+ ()-]*" : undefined);
    return (
      <input
        type={type}
        inputMode={resolvedInputMode}
        pattern={resolvedPattern}
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
