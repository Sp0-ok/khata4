import Dexie, { type Table } from "dexie";

export type PartyType = "customer" | "supplier";
export type TxnType = "credit" | "debit";
export type PaymentMethod = "cash" | "bank" | "easypaisa" | "jazzcash" | "card" | "cheque" | "other";

export interface Party {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type: PartyType;
  photo?: string;
  notes?: string;
  openingBalance: number;
  createdAt: number;
  updatedAt: number;
}

export interface Transaction {
  id?: number;
  partyId: number;
  type: TxnType;
  amount: number;
  note?: string;
  method: PaymentMethod;
  date: number;
  dueDate?: number;
  attachment?: string;
  createdAt: number;
}

export interface Settings {
  id?: number;
  businessName: string;
  ownerName?: string;
  phone?: string;
  currency: string;
  currencySymbol: string;
  theme: "light" | "dark" | "system";
  pinHash?: string;
  onboarded: boolean;
  logo?: string;
}

class LedgerDB extends Dexie {
  parties!: Table<Party, number>;
  transactions!: Table<Transaction, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super("hisaabkitaab_db");
    this.version(1).stores({
      parties: "++id, name, type, phone, createdAt, updatedAt",
      transactions: "++id, partyId, type, date, createdAt",
      settings: "++id",
    });
  }
}

export const db = new LedgerDB();

export const DEFAULT_SETTINGS: Settings = {
  businessName: "My Business",
  currency: "PKR",
  currencySymbol: "Rs",
  theme: "system",
  onboarded: false,
};

// READ-ONLY: safe inside useLiveQuery. Returns default if none persisted.
export const getSettings = async (): Promise<Settings> => {
  const rows = await db.settings.toArray();
  return rows[0] ? rows[0] : { ...DEFAULT_SETTINGS };
};

// Call once at app boot — performs the write if needed.
export const ensureSettings = async (): Promise<Settings> => {
  const rows = await db.settings.toArray();
  if (rows[0]) return rows[0];
  const id = await db.settings.add({ ...DEFAULT_SETTINGS });
  return (await db.settings.get(id))!;
};

export const updateSettings = async (patch: Partial<Settings>) => {
  const rows = await db.settings.toArray();
  if (rows[0]) {
    await db.settings.update(rows[0].id!, patch);
  } else {
    await db.settings.add({ ...DEFAULT_SETTINGS, ...patch });
  }
};

export const getPartyBalance = async (partyId: number): Promise<number> => {
  const party = await db.parties.get(partyId);
  if (!party) return 0;
  const txns = await db.transactions.where("partyId").equals(partyId).toArray();
  const sum = txns.reduce((acc, t) => acc + (t.type === "credit" ? t.amount : -t.amount), 0);
  return (party.openingBalance || 0) + sum;
};

export const getAllBalances = async () => {
  const parties = await db.parties.toArray();
  const txns = await db.transactions.toArray();
  const map = new Map<number, number>();
  for (const p of parties) map.set(p.id!, p.openingBalance || 0);
  for (const t of txns) {
    map.set(t.partyId, (map.get(t.partyId) || 0) + (t.type === "credit" ? t.amount : -t.amount));
  }
  return parties.map(p => ({ party: p, balance: map.get(p.id!) || 0 }));
};

export const formatMoney = (n: number, symbol = "Rs") => {
  const abs = Math.abs(n);
  return `${symbol} ${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

// Onboarding shows only these. Settings shows ALL_CURRENCIES.
export const ONBOARDING_CURRENCIES = [
  { c: "PKR", s: "Rs", name: "Pakistani Rupee" },
  { c: "USD", s: "$", name: "US Dollar" },
  { c: "BHD", s: ".د.ب", name: "Bahraini Dinar" },
  { c: "PHP", s: "₱", name: "Philippine Peso" },
];

export const ALL_CURRENCIES = [
  { c: "PKR", s: "Rs", name: "Pakistani Rupee" },
  { c: "INR", s: "₹", name: "Indian Rupee" },
  { c: "BDT", s: "৳", name: "Bangladeshi Taka" },
  { c: "LKR", s: "Rs", name: "Sri Lankan Rupee" },
  { c: "NPR", s: "Rs", name: "Nepalese Rupee" },
  { c: "AFN", s: "؋", name: "Afghan Afghani" },
  { c: "USD", s: "$", name: "US Dollar" },
  { c: "EUR", s: "€", name: "Euro" },
  { c: "GBP", s: "£", name: "British Pound" },
  { c: "CAD", s: "C$", name: "Canadian Dollar" },
  { c: "AUD", s: "A$", name: "Australian Dollar" },
  { c: "JPY", s: "¥", name: "Japanese Yen" },
  { c: "CNY", s: "¥", name: "Chinese Yuan" },
  { c: "KRW", s: "₩", name: "Korean Won" },
  { c: "SGD", s: "S$", name: "Singapore Dollar" },
  { c: "MYR", s: "RM", name: "Malaysian Ringgit" },
  { c: "IDR", s: "Rp", name: "Indonesian Rupiah" },
  { c: "THB", s: "฿", name: "Thai Baht" },
  { c: "PHP", s: "₱", name: "Philippine Peso" },
  { c: "VND", s: "₫", name: "Vietnamese Dong" },
  { c: "AED", s: "د.إ", name: "UAE Dirham" },
  { c: "SAR", s: "﷼", name: "Saudi Riyal" },
  { c: "QAR", s: "ر.ق", name: "Qatari Riyal" },
  { c: "KWD", s: "د.ك", name: "Kuwaiti Dinar" },
  { c: "BHD", s: ".د.ب", name: "Bahraini Dinar" },
  { c: "OMR", s: "ر.ع.", name: "Omani Rial" },
  { c: "TRY", s: "₺", name: "Turkish Lira" },
  { c: "EGP", s: "E£", name: "Egyptian Pound" },
  { c: "ZAR", s: "R", name: "South African Rand" },
  { c: "NGN", s: "₦", name: "Nigerian Naira" },
  { c: "KES", s: "KSh", name: "Kenyan Shilling" },
  { c: "BRL", s: "R$", name: "Brazilian Real" },
  { c: "MXN", s: "Mex$", name: "Mexican Peso" },
  { c: "CHF", s: "CHF", name: "Swiss Franc" },
  { c: "SEK", s: "kr", name: "Swedish Krona" },
  { c: "NOK", s: "kr", name: "Norwegian Krone" },
  { c: "DKK", s: "kr", name: "Danish Krone" },
  { c: "PLN", s: "zł", name: "Polish Złoty" },
  { c: "RUB", s: "₽", name: "Russian Ruble" },
  { c: "HKD", s: "HK$", name: "Hong Kong Dollar" },
  { c: "NZD", s: "NZ$", name: "New Zealand Dollar" },
];
