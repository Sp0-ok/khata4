import Dexie, { type Table } from "dexie";

export type TxnType = "credit" | "debit";
export type PaymentMethod = "cash" | "bank" | "easypaisa" | "jazzcash" | "card" | "cheque" | "other";
export type InvoiceStatus = "draft" | "sent" | "paid" | "partial";

export interface Party {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
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
  updatedAt?: number;
}

export interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
}

export interface Invoice {
  id?: number;
  number: string;
  partyId?: number;
  partyName: string;
  date: number;
  dueDate?: number;
  items: InvoiceItem[];
  taxPercent: number;
  discount: number;
  notes?: string;
  status: InvoiceStatus;
  paidAmount: number;
  createdAt: number;
}

export interface Expense {
  id?: number;
  title: string;
  amount: number;
  category: string;
  vendor?: string;
  method: PaymentMethod;
  date: number;
  notes?: string;
  createdAt: number;
}

export interface Settings {
  id?: number;
  businessName: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  currency: string;
  currencySymbol: string;
  taxPercent: number;
  invoicePrefix: string;
  invoiceCounter: number;
  theme: "light" | "dark" | "system";
  pinHash?: string;
  onboarded: boolean;
  logo?: string;
  invoiceWatermark?: boolean;
  statementWatermark?: boolean;
  /** Where Capacitor saves PDFs / CSV exports. Asked once on first save. */
  downloadDir?: "documents" | "downloads";
  /** Default country dial code for new parties (e.g. "+92"). */
  defaultCountryCode?: string;
}

class LedgerDB extends Dexie {
  parties!: Table<Party, number>;
  transactions!: Table<Transaction, number>;
  invoices!: Table<Invoice, number>;
  expenses!: Table<Expense, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super("hisaabkitaab_db");
    this.version(1).stores({
      parties: "++id, name, type, phone, createdAt, updatedAt",
      transactions: "++id, partyId, type, date, createdAt",
      settings: "++id",
    });
    this.version(2).stores({
      parties: "++id, name, type, phone, createdAt, updatedAt",
      transactions: "++id, partyId, type, date, createdAt",
      invoices: "++id, number, partyId, date, status, createdAt",
      expenses: "++id, category, date, createdAt",
      settings: "++id",
    }).upgrade(async tx => {
      await tx.table("settings").toCollection().modify((s: any) => {
        if (s.taxPercent == null) s.taxPercent = 0;
        if (!s.invoicePrefix) s.invoicePrefix = "INV-";
        if (s.invoiceCounter == null) s.invoiceCounter = 1;
      });
    });
    // v3: backfill updatedAt on transactions for "last modified" display.
    this.version(3).stores({
      parties: "++id, name, type, phone, createdAt, updatedAt",
      transactions: "++id, partyId, type, date, createdAt, updatedAt",
      invoices: "++id, number, partyId, date, status, createdAt",
      expenses: "++id, category, date, createdAt",
      settings: "++id",
    }).upgrade(async tx => {
      await tx.table("transactions").toCollection().modify((t: any) => {
        if (t.updatedAt == null) t.updatedAt = t.createdAt;
      });
    });
  }
}

export const db = new LedgerDB();

export const DEFAULT_SETTINGS: Settings = {
  businessName: "My Business",
  currency: "PKR",
  currencySymbol: "Rs",
  taxPercent: 0,
  invoicePrefix: "INV-",
  invoiceCounter: 1,
  theme: "system",
  onboarded: false,
  invoiceWatermark: true,
};

export const EXPENSE_CATEGORIES = [
  "Rent", "Utilities", "Salaries", "Inventory", "Transport",
  "Marketing", "Food", "Repairs", "Tax", "Office", "Other",
];

// READ-ONLY: safe inside useLiveQuery.
export const getSettings = async (): Promise<Settings> => {
  const rows = await db.settings.toArray();
  return rows[0] ? rows[0] : { ...DEFAULT_SETTINGS };
};

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
  // Khata convention: "You gave" (debit) → party owes you (+); "You got" (credit) → reduces what they owe (−).
  const sum = txns.reduce((acc, t) => acc + (t.type === "debit" ? t.amount : -t.amount), 0);
  return (party.openingBalance || 0) + sum;
};

export const getAllBalances = async () => {
  const parties = await db.parties.toArray();
  const txns = await db.transactions.toArray();
  const map = new Map<number, number>();
  for (const p of parties) map.set(p.id!, p.openingBalance || 0);
  for (const t of txns) {
    map.set(t.partyId, (map.get(t.partyId) || 0) + (t.type === "debit" ? t.amount : -t.amount));
  }
  return parties.map(p => ({ party: p, balance: map.get(p.id!) || 0 }));
};

export const calcInvoiceTotals = (inv: Pick<Invoice, "items" | "taxPercent" | "discount">) => {
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
  const afterDiscount = Math.max(0, subtotal - (inv.discount || 0));
  const tax = afterDiscount * ((inv.taxPercent || 0) / 100);
  const total = afterDiscount + tax;
  return { subtotal, tax, total };
};

export const nextInvoiceNumber = async (): Promise<string> => {
  const s = await getSettings();
  const num = (s.invoiceCounter || 1).toString().padStart(4, "0");
  return `${s.invoicePrefix || "INV-"}${num}`;
};

export const formatMoney = (n: number, symbol = "Rs") => {
  const abs = Math.abs(n);
  return `${symbol} ${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export const ONBOARDING_CURRENCIES = [
  { c: "PKR", s: "Rs", name: "Pakistani Rupee" },
  { c: "USD", s: "$", name: "US Dollar" },
  { c: "BHD", s: ".د.ب", name: "Bahraini Dinar" },
  { c: "PHP", s: "₱", name: "Philippine Peso" },
];

export const ALL_CURRENCIES = [
  // Top picks first
  { c: "PKR", s: "Rs", name: "Pakistani Rupee" },
  { c: "BHD", s: ".د.ب", name: "Bahraini Dinar" },
  { c: "PHP", s: "₱", name: "Philippine Peso" },
  { c: "USD", s: "$", name: "US Dollar" },
  // Rest
  { c: "INR", s: "₹", name: "Indian Rupee" },
  { c: "BDT", s: "৳", name: "Bangladeshi Taka" },
  { c: "LKR", s: "Rs", name: "Sri Lankan Rupee" },
  { c: "NPR", s: "Rs", name: "Nepalese Rupee" },
  { c: "AFN", s: "؋", name: "Afghan Afghani" },
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
  { c: "VND", s: "₫", name: "Vietnamese Dong" },
  { c: "AED", s: "د.إ", name: "UAE Dirham" },
  { c: "SAR", s: "﷼", name: "Saudi Riyal" },
  { c: "QAR", s: "ر.ق", name: "Qatari Riyal" },
  { c: "KWD", s: "د.ك", name: "Kuwaiti Dinar" },
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
