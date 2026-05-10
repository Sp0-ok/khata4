// Text input that auto-inserts thousands separators while typing.
// Uses Indian grouping for PKR / INR-style currencies, Western elsewhere.
import { forwardRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { formatAmountInput, parseAmountInput } from "@/lib/format";
import { useCurrency } from "@/lib/hooks";

type Props = {
  value: string;          // raw or formatted — we'll re-format on every render
  onChange: (formatted: string, numeric: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

export const AmountInput = forwardRef<HTMLInputElement, Props>(function AmountInput(
  { value, onChange, placeholder = "0", className, autoFocus },
  ref,
) {
  const { settings } = useCurrency();
  const display = useMemo(() => formatAmountInput(value, settings?.currency), [value, settings?.currency]);

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      onChange={e => {
        const next = formatAmountInput(e.target.value, settings?.currency);
        onChange(next, parseAmountInput(next));
      }}
    />
  );
});
