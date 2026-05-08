## 1. Fix the "You'll get / You'll give" logic (root bug)

In `src/lib/db.ts`, change `getPartyBalance` and `getAllBalances` so that:
- `debit` (You gave) → **adds** to balance (party owes you more)
- `credit` (You got) → **subtracts** from balance (party paid back)

Then a positive balance = "You'll get", negative = "You'll give" stays consistent everywhere. Also flip the running-balance math in `src/lib/pdf.ts` (`generateStatementPDF`) so the PDF statement matches.

No UI label changes needed — only the sign convention. Verify on:
- Party detail header (`customers.$id.index.tsx`)
- Parties list totals (`customers.index.tsx`)
- Dashboard receivable/payable (`index.tsx`)

## 2. Party detail screen — edit, delete confirm, import

In `src/routes/customers.$id.index.tsx`:
- Replace the inline "Delete" text button on each transaction with a confirm `AlertDialog` (same pattern already used for party delete).
- Add an **Edit** pencil button on each transaction → opens new route `customers.$id.edit.$txnId.tsx` (form mirrors `customers.$id.add.tsx`, prefilled). On Save → show a confirm `AlertDialog` ("Save changes?") before committing.
- Add an **Import transactions** action in the party's `…` dropdown menu. Accept CSV/JSON of this party's txns (date, type, amount, method, note). Validate, bulk insert via `db.transaction("rw", ...)`, show row count toast.

## 3. Dashboard rework (`src/routes/index.tsx`)

- Remove `Sales (mo)`, `Expense (mo)`, `Profit (mo)` MiniStat row entirely.
- Net Balance = `receivable − payable` from parties only (already does — confirm invoices/expenses are not mixed in; they aren't, but remove the now-unused `invoices`/`expenses` queries and `monthSales/monthExpenses/monthProfit` math).
- Reorder Quick Actions: **You'll Get → You'll Give → New Invoice → Add Expense**.
- Change "You'll Get" / "You'll Give" tiles: instead of linking to `/customers/new`, open a bottom-sheet party picker. If parties exist → list them filtered by type (customer for Get, supplier for Give); selecting one navigates to `customers/$id/add?type=debit` (Get tile = record what you gave them) or `?type=credit` (Give tile = record paying a supplier). If zero parties → fall back to `/customers/new`.

Implement the picker as a reusable `<PartyPickerSheet>` in `src/components/PartyPickerSheet.tsx` using shadcn `Sheet`.

## 4. Reports screen rework (`src/routes/reports.tsx`)

- Add a top segmented switch: **Parties** | **Business** (invoices + expenses).
- Add a second switch: **Bars** | **Lines** (recharts `BarChart` vs `LineChart` with smooth curves, gradient fills under the lines, dot markers).
- **Parties view**: monthly Received vs Given (from `db.transactions`), totals, and Top open balances list.
- **Business view**: existing 6-month Sales vs Expenses chart + Expenses-by-category pie + Sales/Expense/Profit cards. No mixing between the two views.

## 5. Expenses screen copy fix (`src/routes/expenses.index.tsx`)

Replace `"Track every rupee you spend"` with a currency-neutral subtitle: `"Track every {currency} you spend"` using `useCurrency().settings.currency` (e.g. "Track every PKR you spend"), or simply `"Track every expense"` if the currency code feels awkward. Use the dynamic version.

## 6. Settings — business logo (`src/routes/settings.tsx` + `src/lib/db.ts`)

`Settings.logo` field already exists. Add to the Business card:
- A round preview (or placeholder) + "Upload logo" / "Remove" buttons.
- File input (image/*), max ~512 KB, downscale to 256×256 via canvas, store as data URL in `settings.logo`.
- In `src/lib/pdf.ts` `generateInvoicePDF`, if `s.logo` exists, draw it top-left of the header band before the business name (use `doc.addImage(logo, "PNG", x, y, w, h)`).

## 7. Dark theme rework (`src/styles.css`)

Current dark mode is too saturated green. Rebalance:
- `--background`: very dark near-neutral with a hint of cool blue (e.g. `oklch(0.16 0.008 240)`)
- `--card`, `--popover`: `oklch(0.21 0.008 240)`
- `--muted`, `--secondary`, `--accent`: drop chroma to ~0.01–0.02
- `--border`, `--input`: keep neutral white-alpha
- `--primary` stays teal but slightly less saturated (`oklch(0.7 0.1 175)`); `--gradient-primary` tones the green/teal mix down so big surfaces aren't overpowering.
- Keep `--credit` green and `--debit` red as semantic accents only.

Light mode stays as is.

## 8. Verify

After changes, manually verify in preview:
- Add party → You gave 10k → You got 5k → header shows **You'll get 5k** ✓
- Dashboard mini-stats row gone, Net Balance only reflects parties ✓
- Home "You'll Get" tile opens picker with existing parties ✓
- Edit/delete a transaction → confirmation dialog appears ✓
- Reports → switch Parties/Business and Bars/Lines ✓
- Settings → upload logo → generate invoice PDF → logo present ✓
- Toggle dark mode → noticeably less green, more neutral ✓

### Technical notes

- Sign-convention flip is a one-line change per function but touches the meaning of historical data — since data is local-only and the sign was always interpreted at render time the same wrong way, simply flipping the math fixes existing records too (their displayed balance becomes correct). No migration needed.
- `Settings.logo` data URL adds bytes to every backup JSON; that's fine for one logo.
- `<PartyPickerSheet>` keeps the dashboard quick actions snappy without a full route navigation.
- The reports view toggle uses local `useState`, no schema change.
