# Debt Feature — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Owner:** candratama

## Summary

Add a debt tracking feature to Mavlo: a new `debts` table for tracking credit cards, loans, BNPL, and informal debts. Each debt has its own balance, interest rate, and minimum payment. Expense transactions can be linked to a debt as a payment, which automatically reduces the debt's current balance. Net worth and a dashboard widget are updated to reflect total debt.

## Motivation

Personal finance apps that track only spending miss the second half of the picture: liabilities. Without debt tracking:

- Net worth is overstated (cash without subtracting what's owed)
- Users don't see total monthly debt servicing cost
- High-interest debt isn't surfaced as a priority
- BNPL accumulates silently as "fun spending"

This feature surfaces the full debt position, links payments back to specific debts, and warns when debt-to-income (DTI) crosses the 36% safe threshold.

## Decisions

| #   | Question          | Choice                                                                                                                   |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Storage model     | Separate `debts` table (not modeled as accounts)                                                                         |
| 2   | Account linkage   | Optional `accountId` on debt — for credit cards, link to the credit-type account (display only in Phase 1, no auto-sync) |
| 3   | Payment recording | Transactions get a new optional `debtId` column; linked expense reduces `currentBalanceCents` server-side                |
| 4   | Interest tracking | Manual entry only in Phase 1 (auto-accrual is Phase 2)                                                                   |
| 5   | Net worth         | Subtract `sum(debts.currentBalanceCents)` from sum of account balances                                                   |
| 6   | Lending OUT       | Out of scope (user as creditor)                                                                                          |
| 7   | DTI metric        | Compute `monthlyMinPayments / monthlyIncome`, warn at >36%                                                               |
| 8   | Payoff projection | Out of scope for Phase 1 (Phase 2)                                                                                       |

## Data Model

### New table `debts`

```ts
export const debts = sqliteTable(
	'debts',
	{
		id: cuid().primaryKey(),
		userId: userIdFk(),
		name: text('name').notNull(),
		type: text('type', {
			enum: ['credit_card', 'kta', 'kpr', 'auto', 'bnpl', 'pinjol', 'informal', 'other']
		}).notNull(),
		lender: text('lender'),
		principalCents: integer('principal_cents', { mode: 'number' }).notNull(),
		currentBalanceCents: integer('current_balance_cents', { mode: 'number' }).notNull(),
		interestRatePct: integer('interest_rate_pct', { mode: 'number' }).notNull().default(0),
		// Stored as integer percent × 100 (so 26.5% → 2650) to avoid floats.
		minimumPaymentCents: integer('minimum_payment_cents', { mode: 'number' }).notNull().default(0),
		dueDay: integer('due_day', { mode: 'number' }), // 1-31, nullable for BNPL
		startDate: integer('start_date', { mode: 'number' }).notNull(),
		maturityDate: integer('maturity_date', { mode: 'number' }),
		status: text('status', { enum: ['active', 'paid_off', 'in_arrears'] })
			.notNull()
			.default('active'),
		accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
		note: text('note'),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
	},
	(t) => [
		index('debts_user_idx').on(t.userId),
		index('debts_user_status_idx').on(t.userId, t.status)
	]
);
```

### `transactions` schema change

Add nullable `debt_id` column referencing `debts.id` with `ON DELETE SET NULL`:

```ts
debtId: text('debt_id').references(() => debts.id, { onDelete: 'set null' }),
```

Add index `tx_debt_idx` on `debtId` for payment-history queries.

## Validation Rules

`src/lib/validation/debt.ts` (Zod):

**Create:**

- `name`: non-empty, max 100
- `type`: enum value
- `lender`: optional, max 100
- `principalCents`: positive int
- `currentBalanceCents`: non-negative int ≤ principalCents × 2 (sanity cap)
- `interestRatePct`: 0–10000 (0% to 100% APR stored as int × 100)
- `minimumPaymentCents`: non-negative int
- `dueDay`: optional, 1–31
- `startDate`: ISO date or epoch ms
- `maturityDate`: optional, must be > startDate when present
- `accountId`: optional, must reference user's own credit-type account
- `note`: optional, max 200

**Update:** same fields plus `id`. `userId` immutable.

**Mark paid off:** sets `status='paid_off'`, `currentBalanceCents=0`.

## Repositories

### `src/lib/server/repositories/debts.ts`

```ts
listDebts(db, userId, { status? }): DebtRow[]
getDebt(db, userId, id): DebtRow | null
createDebt(db, userId, input): DebtRow | RepoError
updateDebt(db, userId, input): DebtRow | RepoError
deleteDebt(db, userId, id): DebtRow | null
markDebtPaidOff(db, userId, id): DebtRow | null
```

`createDebt` rejects if `accountId` doesn't belong to user or isn't a credit-type account.

### Payment-side hooks (in `transactions.ts` repo)

When inserting an expense transaction with `debtId`:

- Verify debt belongs to user
- After insert, decrement `debts.currentBalanceCents` by `transaction.amountCents`
- Clamp at 0 (no negative balances — overpayments stop at zero)
- If `currentBalanceCents === 0` and status was 'active', auto-flip to `paid_off`

When updating a transaction:

- If `debtId` changed (added, removed, or switched), reverse the old debt's balance and apply to the new one.
- If amount changed and debtId unchanged, reverse old amount and apply new.

When deleting a transaction with `debtId`:

- Add the amount back to the debt's balance.
- If status was `paid_off` and balance becomes >0, flip back to `active`.

All hooks scoped to user. Existing transaction repo functions get `debtId` plumbed through.

### `src/lib/server/repositories/debt-stats.ts` (new)

```ts
computeDebtTotals(db, userId): {
  totalBalanceCents: number,
  totalMinPaymentCents: number,
  upcomingPayments: Array<{ debtId, debtName, dueDate, minAmountCents }>
}
```

Upcoming payments: next due date for each active debt within 30 days.

## Server Actions

`src/routes/(app)/debts/+page.server.ts`:

```ts
actions = {
  create: ...,        // create new debt
  update: ...,        // edit debt
  delete: ...,        // delete (existing payments keep history, lose link)
  markPaidOff: ...    // flip status
}
```

Pattern identical to budgets/+page.server.ts.

Transactions actions (existing `src/routes/(app)/transactions/+page.server.ts`) extend to accept `debtId` in create/update form data. Payment hooks fire automatically inside the transactions repo.

## Page Loads

`src/routes/(app)/+layout.server.ts` adds in parallel:

- `listDebts(db, user.id, {})` → `debts: DebtRow[]`
- `computeDebtTotals(db, user.id)` → `debtTotals: {...}`

Net worth:

```ts
netWorthCents = sum(balances) - debtTotals.totalBalanceCents;
```

DTI ratio: `debtTotals.totalMinPaymentCents / monthIncomeCents`. Computed in dashboard page (client-side).

## UI — `/debts` list page

File: `src/routes/(app)/debts/+page.svelte`

```
Debts                                  [+ Add debt]

┌─ Total ──────────────────────────────┐
│ Rp 12.500.000 owed                   │
│ Rp 850.000/month minimum             │
│ DTI 17% ✓     (or amber when >36%)   │
└──────────────────────────────────────┘

┌─ Credit Card BCA ─────────────────[⋯]┐
│ Visa · Bank BCA                       │
│ Rp 4.500.000 / Rp 10.000.000          │
│ ████████░░░░░░░ 45% used              │
│ APR 26.0% · Due day 15 · Min 250K     │
│ [Record payment]                      │
└──────────────────────────────────────┘

(repeat per active debt)

Paid-off debts (collapsed):
  └─ chevron → reveal list of paid-off debts
```

Card shows:

- Type icon + name + lender
- Balance / principal
- Bar (% paid down — `(principal - balance) / principal * 100`)
- APR, due day, min payment
- Bar color: amber if APR >20%, red if >30%, default emerald
- "Record payment" CTA → opens AddTransactionSheet with debt prefilled

Dropdown menu: Edit, Mark paid off, Delete (with confirmation when payments exist).

## UI — `/debts/[id]` detail page

File: `src/routes/(app)/debts/[id]/+page.svelte`

```
← Debts

Credit Card BCA                     [⋯]
Visa · Bank BCA · APR 26%

┌──────────────────────────────────────┐
│ Balance: Rp 4.500.000                │
│ Original: Rp 10.000.000 (45% paid)   │
│ ████████████░░░░░░░░                 │
│ Min payment: Rp 250.000              │
│ Next due: May 15, 2026               │
└──────────────────────────────────────┘

[Record payment]

Payment history (all time, paginated 20):
─ May 15  ─Rp 500.000  Bank Mandiri
─ Apr 15  ─Rp 250.000  Cash
...
```

Payment history derives from `data.transactions.filter(t => t.debtId === params.id)` since transactions are already hoisted in layout.

## UI — Add/Edit debt dialog

Same pattern as budget create/edit (Dialog desktop, Sheet mobile).

Form fields:

- Name (text, required)
- Type (PickerSheet — credit_card, kta, kpr, auto, bnpl, pinjol, informal, other)
- Lender (text, optional)
- Principal / credit limit (MoneyInput, required)
- Current balance (MoneyInput, required, default = principal at create)
- APR % (numeric input with 2-decimal precision, stored as int × 100)
- Min payment (MoneyInput, optional)
- Due day (numeric 1–31, optional)
- Start date (date picker, required)
- Maturity date (date picker, optional)
- Linked account (PickerSheet — credit-type accounts only, optional)
- Note (text, optional, max 200)

**Smart defaults by type:**

- `credit_card`: APR placeholder 26, dueDay shown
- `bnpl`: APR 0, dueDay hidden, minPayment required
- `kpr`/`auto`: APR placeholder 12, maturityDate shown
- `informal`: APR 0, dueDay hidden

## UI — AddTransactionSheet integration

Existing `src/lib/components/forms/add-transaction-sheet.svelte` extends:

When `kind === 'expense'`:

- Add optional "Link to debt" PickerSheet listing active debts
- When debt is picked:
  - Auto-set category to "Debt Payment" (create category on first use)
  - Auto-prefill amount with debt's `minimumPaymentCents` if currently 0/empty
  - Show hint "Will reduce {debtName} balance"

When form submitted:

- Hidden field `debtId` posts along
- Server inserts transaction → repo hook decrements debt balance

When transaction is edited via the sheet:

- Same `debtId` field — repo handles change/reverse-and-reapply.

## UI — Dashboard widget

Insert after Monthly Budget card, before Unbudgeted callout:

```
┌─ Debt ───────────────────────────────┐
│ Rp 12.500.000 total                  │
│ Rp 850.000/month minimum             │
│                                      │
│ DTI 42% — above safe threshold       │  (when DTI > 36%)
│                                      │
│ Upcoming: May 15 · Rp 250.000 CC BCA │
└──────────────────────────────────────┘
```

Click → /debts.

Only renders when `data.debts.some((d) => d.status === 'active')`.

Net worth widget already updated via layout load formula.

## Categories

A new category "Debt Payment" (kind=`expense`, icon `wallet`) is auto-created on demand the first time a transaction is linked to a debt and no such category exists for the user. Same lazy-init pattern as `userPreferences`.

## Edge Cases

| Case                                            | Behavior                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Delete debt with payment history                | Confirm dialog. FK cascade sets `transactions.debt_id` to NULL but keeps the transactions.               |
| Edit transaction's amount that's linked to debt | Repo reverses old amount, applies new — net change applied to balance.                                   |
| Edit transaction to remove debt link            | Reverse old debt balance, no new application.                                                            |
| Edit transaction to add debt link               | Apply new debt balance reduction.                                                                        |
| Overpayment (tx amount > debt balance)          | Balance clamped at 0; tx still records full amount as expense; toast "Overpaid by X — debt marked paid". |
| Demo seed                                       | One sample credit card debt with one payment transaction.                                                |
| Multi-currency                                  | Out of scope, single-currency assumption holds.                                                          |
| Auto-archive paid-off debts                     | Status flips to `paid_off`; UI groups them in collapsed section.                                         |
| Restoring a paid-off debt to active             | Edit modal → status select → save.                                                                       |

## Testing

Mirrors budget tests pattern.

- `src/lib/validation/debt.test.ts` — Zod schema coverage
- `src/lib/server/repositories/debts.test.ts` — CRUD + paid-off transition + scoping
- `src/lib/server/repositories/transactions.test.ts` — extend with payment-hook tests (create/update/delete tx with debtId)
- `src/lib/server/repositories/debt-stats.test.ts` — `computeDebtTotals` upcoming + sums

No e2e tests (none in repo currently). Manual verification per UI flow.

## Out of Scope (Phase 1)

- Lending OUT (user as creditor)
- Auto interest accrual (background job adds monthly interest as expense)
- Payoff timeline projection
- Snowball vs avalanche strategy recommender
- Multi-currency debts
- Refinancing calculator
- Bulk import from bank statements
