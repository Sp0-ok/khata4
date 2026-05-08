import { useLiveQuery } from "dexie-react-hooks";
import { db, formatMoney, getSettings } from "@/lib/db";

export function useCurrency() {
  const settings = useLiveQuery(() => getSettings(), []);
  const symbol = settings?.currencySymbol || "Rs";
  return {
    symbol,
    format: (n: number) => formatMoney(n, symbol),
    settings,
  };
}

export function useParties() {
  return useLiveQuery(() => db.parties.orderBy("updatedAt").reverse().toArray(), []);
}
