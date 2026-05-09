import { useMemo, useState } from "react";

type Screen = "home" | "parties" | "record" | "expenses" | "reports" | "settings";
type RecordMode = "gave" | "got";

type Party = {
  id: string;
  name: string;
  phone: string;
  openingBalance: number;
  createdAt: number;
};

type LedgerEntry = {
  id: string;
  partyId: string;
  type: RecordMode;
  amount: number;
  note: string;
  createdAt: number;
};

type Expense = {
  id: string;
  title: string;
  amount: number;
  note: string;
  createdAt: number;
};

type Settings = {
  onboarded: boolean;
  businessName: string;
  ownerName: string;
  currencySymbol: string;
};

type AppData = {
  settings: Settings;
  parties: Party[];
  entries: LedgerEntry[];
  expenses: Expense[];
};

const STORAGE_KEY = "hisaab_kitaab_android_v1";

const defaultData: AppData = {
  settings: {
    onboarded: false,
    businessName: "My Business",
    ownerName: "",
    currencySymbol: "Rs",
  },
  parties: [],
  entries: [],
  expenses: [],
};

function readData(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      settings: { ...defaultData.settings, ...parsed.settings },
      parties: Array.isArray(parsed.parties) ? parsed.parties : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch {
    return defaultData;
  }
}

function writeData(data: AppData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Keep the app usable even if storage is unavailable.
  }
}

function money(amount: number, symbol: string) {
  return `${symbol} ${Math.abs(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getPartyBalance(party: Party, entries: LedgerEntry[]) {
  return entries
    .filter((entry) => entry.partyId === party.id)
    .reduce((total, entry) => total + (entry.type === "gave" ? entry.amount : -entry.amount), party.openingBalance || 0);
}

function todayLabel(time: number) {
  return new Date(time).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function AndroidApp() {
  const [data, setData] = useState<AppData>(() => readData());
  const [screen, setScreen] = useState<Screen>("home");
  const [recordMode, setRecordMode] = useState<RecordMode>("gave");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [setupName, setSetupName] = useState(data.settings.businessName === "My Business" ? "" : data.settings.businessName);
  const [setupSymbol, setSetupSymbol] = useState(data.settings.currencySymbol);
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [partyOpening, setPartyOpening] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [settingsName, setSettingsName] = useState(data.settings.businessName);
  const [settingsOwner, setSettingsOwner] = useState(data.settings.ownerName);
  const [settingsSymbol, setSettingsSymbol] = useState(data.settings.currencySymbol);
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const save = (next: AppData, message?: string) => {
    setData(next);
    writeData(next);
    if (message) setNotice(message);
  };

  const balances = useMemo(() => {
    return data.parties.map((party) => ({ party, balance: getPartyBalance(party, data.entries) }));
  }, [data.parties, data.entries]);

  const totalGet = balances.reduce((sum, item) => sum + Math.max(item.balance, 0), 0);
  const totalGive = balances.reduce((sum, item) => sum + Math.max(-item.balance, 0), 0);
  const expensesTotal = data.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const net = totalGet - totalGive - expensesTotal;

  const finishSetup = (skip = false) => {
    const next: AppData = {
      ...data,
      settings: {
        ...data.settings,
        onboarded: true,
        businessName: skip || !setupName.trim() ? "My Business" : setupName.trim(),
        currencySymbol: setupSymbol.trim() || "Rs",
      },
    };
    setSettingsName(next.settings.businessName);
    setSettingsSymbol(next.settings.currencySymbol);
    save(next, "Setup saved");
  };

  const addParty = () => {
    const name = partyName.trim();
    if (!name) {
      setNotice("Enter a customer name");
      return;
    }
    const openingBalance = Number(partyOpening || 0);
    const next: AppData = {
      ...data,
      parties: [
        { id: newId("party"), name, phone: partyPhone.trim(), openingBalance: Number.isFinite(openingBalance) ? openingBalance : 0, createdAt: Date.now() },
        ...data.parties,
      ],
    };
    setPartyName("");
    setPartyPhone("");
    setPartyOpening("");
    save(next, "Party added");
  };

  const deleteParty = (id: string) => {
    const next: AppData = {
      ...data,
      parties: data.parties.filter((party) => party.id !== id),
      entries: data.entries.filter((entry) => entry.partyId !== id),
    };
    if (selectedPartyId === id) setSelectedPartyId("");
    save(next, "Party deleted");
  };

  const startRecord = (mode: RecordMode, partyId = "") => {
    setRecordMode(mode);
    setSelectedPartyId(partyId || data.parties[0]?.id || "");
    setEntryAmount("");
    setEntryNote("");
    setScreen("record");
  };

  const addEntry = () => {
    if (!selectedPartyId) {
      setNotice("Add or choose a party first");
      return;
    }
    const amount = Number(entryAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Enter a valid amount");
      return;
    }
    const next: AppData = {
      ...data,
      entries: [
        { id: newId("entry"), partyId: selectedPartyId, type: recordMode, amount, note: entryNote.trim(), createdAt: Date.now() },
        ...data.entries,
      ],
    };
    setEntryAmount("");
    setEntryNote("");
    save(next, "Entry saved");
    setScreen("home");
  };

  const deleteEntry = (id: string) => {
    save({ ...data, entries: data.entries.filter((entry) => entry.id !== id) }, "Entry deleted");
  };

  const addExpense = () => {
    const title = expenseTitle.trim();
    const amount = Number(expenseAmount);
    if (!title) {
      setNotice("Enter an expense title");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Enter a valid expense amount");
      return;
    }
    const next: AppData = {
      ...data,
      expenses: [{ id: newId("expense"), title, amount, note: expenseNote.trim(), createdAt: Date.now() }, ...data.expenses],
    };
    setExpenseTitle("");
    setExpenseAmount("");
    setExpenseNote("");
    save(next, "Expense saved");
  };

  const deleteExpense = (id: string) => {
    save({ ...data, expenses: data.expenses.filter((expense) => expense.id !== id) }, "Expense deleted");
  };

  const saveSettings = () => {
    const next: AppData = {
      ...data,
      settings: {
        ...data.settings,
        businessName: settingsName.trim() || "My Business",
        ownerName: settingsOwner.trim(),
        currencySymbol: settingsSymbol.trim() || "Rs",
      },
    };
    save(next, "Settings saved");
  };

  const resetAll = () => {
    setConfirmReset(false);
    setScreen("home");
    setData(defaultData);
    writeData(defaultData);
    setNotice("Data cleared");
  };

  const selectedParty = data.parties.find((party) => party.id === selectedPartyId);
  const selectedBalance = selectedParty ? getPartyBalance(selectedParty, data.entries) : 0;

  if (!data.settings.onboarded) {
    return (
      <main className="android-app setup-screen">
        <section className="setup-panel">
          <div>
            <p className="eyebrow">Hisaab Kitaab</p>
            <h1>Set up your khata</h1>
          </div>
          <label className="field">
            <span>Business name</span>
            <input value={setupName} onChange={(event) => setSetupName(event.target.value)} inputMode="text" autoComplete="organization" />
          </label>
          <label className="field">
            <span>Currency symbol</span>
            <input value={setupSymbol} onChange={(event) => setSetupSymbol(event.target.value)} inputMode="text" autoComplete="off" />
          </label>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => finishSetup(true)}>Skip</button>
            <button type="button" className="primary-button" onClick={() => finishSetup(false)}>Next</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="android-app">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Hisaab Kitaab</p>
          <h1>{data.settings.businessName}</h1>
        </div>
        <button type="button" className="icon-button" onClick={() => { setScreen("settings"); setNotice(""); }} aria-label="Settings">⚙</button>
      </header>

      {notice ? (
        <button type="button" className="notice" onClick={() => setNotice("")}>{notice}</button>
      ) : null}

      <section className="content-area">
        {screen === "home" ? (
          <div className="stack">
            <section className="balance-card">
              <span>Net balance</span>
              <strong>{net < 0 ? "-" : ""}{money(net, data.settings.currencySymbol)}</strong>
              <div className="metric-grid">
                <div><small>You will get</small><b>{money(totalGet, data.settings.currencySymbol)}</b></div>
                <div><small>You will give</small><b>{money(totalGive, data.settings.currencySymbol)}</b></div>
                <div><small>Expenses</small><b>{money(expensesTotal, data.settings.currencySymbol)}</b></div>
              </div>
            </section>
            <div className="quick-grid">
              <button type="button" onClick={() => setScreen("parties")}>Add party</button>
              <button type="button" onClick={() => startRecord("gave")}>You gave</button>
              <button type="button" onClick={() => startRecord("got")}>You got</button>
              <button type="button" onClick={() => setScreen("expenses")}>Expense</button>
            </div>
            <SectionTitle title="Recent entries" />
            {data.entries.length === 0 ? <Empty text="No entries yet" /> : data.entries.slice(0, 8).map((entry) => {
              const party = data.parties.find((item) => item.id === entry.partyId);
              return <EntryRow key={entry.id} entry={entry} partyName={party?.name || "Deleted party"} symbol={data.settings.currencySymbol} onDelete={() => deleteEntry(entry.id)} />;
            })}
          </div>
        ) : null}

        {screen === "parties" ? (
          <div className="stack">
            <SectionTitle title="Parties" />
            <div className="form-card">
              <label className="field"><span>Name</span><input value={partyName} onChange={(event) => setPartyName(event.target.value)} inputMode="text" autoComplete="name" /></label>
              <label className="field"><span>Phone</span><input value={partyPhone} onChange={(event) => setPartyPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label>
              <label className="field"><span>Opening balance</span><input value={partyOpening} onChange={(event) => setPartyOpening(event.target.value)} inputMode="decimal" /></label>
              <button type="button" className="primary-button wide" onClick={addParty}>Save party</button>
            </div>
            {balances.length === 0 ? <Empty text="No parties saved" /> : balances.map(({ party, balance }) => (
              <article key={party.id} className="list-card">
                <div>
                  <h3>{party.name}</h3>
                  <p>{party.phone || "No phone"}</p>
                  <strong className={balance >= 0 ? "good" : "bad"}>{balance >= 0 ? "Get " : "Give "}{money(balance, data.settings.currencySymbol)}</strong>
                </div>
                <div className="mini-actions">
                  <button type="button" onClick={() => startRecord("gave", party.id)}>Gave</button>
                  <button type="button" onClick={() => startRecord("got", party.id)}>Got</button>
                  <button type="button" className="danger" onClick={() => deleteParty(party.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {screen === "record" ? (
          <div className="stack">
            <SectionTitle title="Record entry" />
            <div className="segmented">
              <button type="button" className={recordMode === "gave" ? "active" : ""} onClick={() => setRecordMode("gave")}>You gave</button>
              <button type="button" className={recordMode === "got" ? "active" : ""} onClick={() => setRecordMode("got")}>You got</button>
            </div>
            <div className="form-card">
              <label className="field"><span>Party</span><select value={selectedPartyId} onChange={(event) => setSelectedPartyId(event.target.value)}>{data.parties.length === 0 ? <option value="">Add a party first</option> : data.parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
              <label className="field"><span>Amount</span><input value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} inputMode="decimal" /></label>
              <label className="field"><span>Note</span><textarea value={entryNote} onChange={(event) => setEntryNote(event.target.value)} rows={3} /></label>
              {selectedParty ? <p className="hint">Current balance: {selectedBalance >= 0 ? "Get " : "Give "}{money(selectedBalance, data.settings.currencySymbol)}</p> : null}
              <button type="button" className="primary-button wide" onClick={addEntry}>Save entry</button>
            </div>
          </div>
        ) : null}

        {screen === "expenses" ? (
          <div className="stack">
            <SectionTitle title="Expenses" />
            <div className="form-card">
              <label className="field"><span>Title</span><input value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} inputMode="text" /></label>
              <label className="field"><span>Amount</span><input value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} inputMode="decimal" /></label>
              <label className="field"><span>Note</span><textarea value={expenseNote} onChange={(event) => setExpenseNote(event.target.value)} rows={3} /></label>
              <button type="button" className="primary-button wide" onClick={addExpense}>Save expense</button>
            </div>
            {data.expenses.length === 0 ? <Empty text="No expenses saved" /> : data.expenses.map((expense) => (
              <article key={expense.id} className="list-card compact">
                <div><h3>{expense.title}</h3><p>{todayLabel(expense.createdAt)} · {expense.note || "No note"}</p></div>
                <div className="amount-block"><strong>{money(expense.amount, data.settings.currencySymbol)}</strong><button type="button" className="danger" onClick={() => deleteExpense(expense.id)}>Delete</button></div>
              </article>
            ))}
          </div>
        ) : null}

        {screen === "reports" ? (
          <div className="stack">
            <SectionTitle title="Reports" />
            <div className="report-grid">
              <ReportBox label="Parties" value={String(data.parties.length)} />
              <ReportBox label="Entries" value={String(data.entries.length)} />
              <ReportBox label="Receivable" value={money(totalGet, data.settings.currencySymbol)} />
              <ReportBox label="Payable" value={money(totalGive, data.settings.currencySymbol)} />
              <ReportBox label="Expenses" value={money(expensesTotal, data.settings.currencySymbol)} />
              <ReportBox label="Net" value={`${net < 0 ? "-" : ""}${money(net, data.settings.currencySymbol)}`} />
            </div>
          </div>
        ) : null}

        {screen === "settings" ? (
          <div className="stack">
            <SectionTitle title="Settings" />
            <div className="form-card">
              <label className="field"><span>Business name</span><input value={settingsName} onChange={(event) => setSettingsName(event.target.value)} inputMode="text" /></label>
              <label className="field"><span>Owner name</span><input value={settingsOwner} onChange={(event) => setSettingsOwner(event.target.value)} inputMode="text" /></label>
              <label className="field"><span>Currency symbol</span><input value={settingsSymbol} onChange={(event) => setSettingsSymbol(event.target.value)} inputMode="text" /></label>
              <button type="button" className="primary-button wide" onClick={saveSettings}>Save settings</button>
            </div>
            <div className="form-card danger-zone">
              <h3>Reset app</h3>
              <p>This clears parties, entries, expenses and setup on this device.</p>
              {confirmReset ? (
                <div className="button-row">
                  <button type="button" className="secondary-button" onClick={() => setConfirmReset(false)}>Cancel</button>
                  <button type="button" className="danger-button" onClick={resetAll}>Clear all</button>
                </div>
              ) : <button type="button" className="danger-button wide" onClick={() => setConfirmReset(true)}>Reset data</button>}
            </div>
          </div>
        ) : null}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation">
        <TabButton active={screen === "home"} label="Home" onClick={() => setScreen("home")} />
        <TabButton active={screen === "parties"} label="Parties" onClick={() => setScreen("parties")} />
        <TabButton active={screen === "record"} label="Record" onClick={() => startRecord("gave")} />
        <TabButton active={screen === "expenses"} label="Expenses" onClick={() => setScreen("expenses")} />
        <TabButton active={screen === "reports"} label="Reports" onClick={() => setScreen("reports")} />
      </nav>
    </main>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="section-title">{title}</h2>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function EntryRow({ entry, partyName, symbol, onDelete }: { entry: LedgerEntry; partyName: string; symbol: string; onDelete: () => void }) {
  return (
    <article className="list-card compact">
      <div>
        <h3>{partyName}</h3>
        <p>{todayLabel(entry.createdAt)} · {entry.note || (entry.type === "gave" ? "You gave" : "You got")}</p>
      </div>
      <div className="amount-block">
        <strong className={entry.type === "gave" ? "good" : "bad"}>{entry.type === "gave" ? "+" : "-"}{money(entry.amount, symbol)}</strong>
        <button type="button" className="danger" onClick={onDelete}>Delete</button>
      </div>
    </article>
  );
}

function ReportBox({ label, value }: { label: string; value: string }) {
  return <div className="report-box"><span>{label}</span><strong>{value}</strong></div>;
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{label}</button>;
}
