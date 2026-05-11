// Locale-aware amount formatting for live input.
// PKR / INR / BDT use Indian grouping (1,00,000).
// Everything else uses Western grouping (100,000).

const INDIAN = new Set(["PKR", "INR", "BDT"]);

export function isIndianGrouping(currency?: string) {
  return !!currency && INDIAN.has(currency.toUpperCase());
}

/** Format a raw user-typed string into a grouped amount, preserving trailing dot. */
export function formatAmountInput(raw: string, currency?: string): string {
  if (raw == null) return "";
  // Strip everything except digits and the FIRST dot.
  let s = String(raw).replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intRaw, decRaw = ""] = s.split(".");
  const intClean = intRaw.replace(/^0+(?=\d)/, ""); // drop leading zeros (keep "0")
  const dec = decRaw.slice(0, 2);
  const hasDot = s.includes(".");

  if (!intClean && !hasDot) return "";
  const intGrouped = intClean
    ? formatIntGroup(intClean, isIndianGrouping(currency))
    : "0";
  if (!hasDot) return intGrouped;
  return intGrouped + "." + dec;
}

function formatIntGroup(intStr: string, indian: boolean): string {
  if (intStr.length <= 3) return intStr;
  if (!indian) {
    // Western: groups of 3 from the right.
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  // Indian: last 3 digits, then groups of 2.
  const last3 = intStr.slice(-3);
  const head = intStr.slice(0, -3);
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

/** Parse a formatted amount back to a number for storage / arithmetic. */
export function parseAmountInput(formatted: string): number {
  if (!formatted) return 0;
  const n = parseFloat(String(formatted).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
