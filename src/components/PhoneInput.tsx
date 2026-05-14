// Phone field with a country-code selector (default +92).
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { COUNTRY_CODES } from "@/lib/countryCodes";

type Props = {
  code: string;
  rest: string;
  onChange: (code: string, rest: string) => void;
  placeholder?: string;
};

export function PhoneInput({ code, rest, onChange, placeholder = "Phone number" }: Props) {
  // Combine code + iso so each option key is unique (some codes repeat — e.g. +1).
  const opts = useMemo(
    () => COUNTRY_CODES.map(c => ({ key: `${c.code}__${c.iso}`, ...c })),
    [],
  );
  const currentKey = useMemo(() => {
    const match = opts.find(o => o.code === code);
    return match ? match.key : opts[0].key;
  }, [code, opts]);

  return (
    <div className="flex gap-2">
      <Select
        value={currentKey}
        onValueChange={k => {
          const o = opts.find(x => x.key === k);
          if (o) onChange(o.code, rest);
        }}
      >
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {opts.map(o => (
            <SelectItem key={o.key} value={o.key}>
              <span className="tabular">{o.code}</span> <span className="text-muted-foreground">{o.iso}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={rest}
        onChange={e => onChange(code, e.target.value)}
        placeholder={placeholder}
        type="tel"
        inputMode="tel"
        maxLength={20}
        className="flex-1"
      />
    </div>
  );
}
