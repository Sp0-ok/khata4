// Country dial codes — top 4 first (PK, BH, PH, US), then the rest alphabetised.
export type CountryCode = { code: string; iso: string; name: string };

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+92",  iso: "PK", name: "Pakistan" },
  { code: "+973", iso: "BH", name: "Bahrain" },
  { code: "+63",  iso: "PH", name: "Philippines" },
  { code: "+1",   iso: "US", name: "United States" },

  { code: "+93",  iso: "AF", name: "Afghanistan" },
  { code: "+61",  iso: "AU", name: "Australia" },
  { code: "+880", iso: "BD", name: "Bangladesh" },
  { code: "+55",  iso: "BR", name: "Brazil" },
  { code: "+1",   iso: "CA", name: "Canada" },
  { code: "+86",  iso: "CN", name: "China" },
  { code: "+45",  iso: "DK", name: "Denmark" },
  { code: "+20",  iso: "EG", name: "Egypt" },
  { code: "+33",  iso: "FR", name: "France" },
  { code: "+49",  iso: "DE", name: "Germany" },
  { code: "+852", iso: "HK", name: "Hong Kong" },
  { code: "+91",  iso: "IN", name: "India" },
  { code: "+62",  iso: "ID", name: "Indonesia" },
  { code: "+39",  iso: "IT", name: "Italy" },
  { code: "+81",  iso: "JP", name: "Japan" },
  { code: "+254", iso: "KE", name: "Kenya" },
  { code: "+965", iso: "KW", name: "Kuwait" },
  { code: "+60",  iso: "MY", name: "Malaysia" },
  { code: "+52",  iso: "MX", name: "Mexico" },
  { code: "+977", iso: "NP", name: "Nepal" },
  { code: "+64",  iso: "NZ", name: "New Zealand" },
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+47",  iso: "NO", name: "Norway" },
  { code: "+968", iso: "OM", name: "Oman" },
  { code: "+48",  iso: "PL", name: "Poland" },
  { code: "+974", iso: "QA", name: "Qatar" },
  { code: "+7",   iso: "RU", name: "Russia" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+65",  iso: "SG", name: "Singapore" },
  { code: "+27",  iso: "ZA", name: "South Africa" },
  { code: "+82",  iso: "KR", name: "South Korea" },
  { code: "+34",  iso: "ES", name: "Spain" },
  { code: "+94",  iso: "LK", name: "Sri Lanka" },
  { code: "+46",  iso: "SE", name: "Sweden" },
  { code: "+41",  iso: "CH", name: "Switzerland" },
  { code: "+66",  iso: "TH", name: "Thailand" },
  { code: "+90",  iso: "TR", name: "Turkey" },
  { code: "+971", iso: "AE", name: "UAE" },
  { code: "+44",  iso: "GB", name: "United Kingdom" },
  { code: "+84",  iso: "VN", name: "Vietnam" },
];

const SORTED_CODES = [...new Set(COUNTRY_CODES.map(c => c.code))]
  .sort((a, b) => b.length - a.length); // longest first so "+973" matches before "+9"

export const DEFAULT_COUNTRY_CODE = "+92";

/** Split a stored phone like "+92 0300-1234567" into { code, rest }. */
export function splitPhone(phone?: string): { code: string; rest: string } {
  const p = (phone || "").trim();
  if (!p) return { code: DEFAULT_COUNTRY_CODE, rest: "" };
  for (const c of SORTED_CODES) {
    if (p.startsWith(c)) {
      return { code: c, rest: p.slice(c.length).trim() };
    }
  }
  return { code: DEFAULT_COUNTRY_CODE, rest: p };
}

/** Combine a country code + rest into a single saveable string. */
export function joinPhone(code: string, rest: string): string {
  const r = (rest || "").trim();
  if (!r) return "";
  return `${code} ${r}`;
}
