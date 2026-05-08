import Dexie, { type Table } from "dexie";

export type PartyType = "customer" | "supplier";
export type TxnType = "credit" | "debit"; // credit = they owe you (you'll get); debit = you owe (you'll give)
export type PaymentMethod = "cash" | "bank" | "easypaisa" | "jazzcash" | "card" | "cheque" | "other";

export interface Party {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  type: PartyType;
  photo?: string; // dataURL
  notes?: string;
  openingBalance: number; // positive = they owe you, negative = you owe them
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
  attachment?: string; // dataURL of image/receipt
  createdAt: number;
}

export interface Settings {
  id?: number;
  businessName: string;
  ownerName?: string;
  phone?: string;
  currency: string; // e.g., "PKR"
  currencySymbol: string; // e.g., "Rs"
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
    super("bahibook_db");
    this.version(1).stores({
      parties: "++id, name, type, phone, createdAt, updatedAt",
      transactions: "++id, partyId, type, date, createdAt",
      settings: "++id",
    });
  }
}

export const db = new LedgerDB();

// --- Helpers ---

export const getSettings = async (): Promise<Settings> => {
  const s = await db.settings.toArray();
  if (s[0]) return s[0];
  const id = await db.settings.add({
    businessName: "My Business",
    currency: "PKR",
    currencySymbol: "Rs",
    theme: "system",
    onboarded: false,
  });
  return (await db.settings.get(id))!;
};

export const updateSettings = async (patch: Partial<Settings>) => {
  const s = await getSettings();
  await db.settings.update(s.id!, patch);
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
