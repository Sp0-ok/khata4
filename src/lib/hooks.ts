import { useLiveQuery } from "dexie-react-hooks";
import { db, formatMoney, DEFAULT_SETTINGS } from "@/lib/db";

export function useCurrency() {
  // Read-only liveQuery — never triggers a write.
  const settings = useLiveQuery(() => db.settings.toArray().then(r => r[0] ?? DEFAULT_SETTINGS), []);
  const symbol = settings?.currencySymbol || "Rs";
  const currency = settings?.currency;
  return {
    symbol,
    currency,
    format: (n: number) => formatMoney(n, symbol, currency),
    settings,
  };
}

export function useParties() {
  return useLiveQuery(() => db.parties.orderBy("updatedAt").reverse().toArray(), []);
}
