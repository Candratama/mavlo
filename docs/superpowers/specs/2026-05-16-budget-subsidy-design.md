# Budget Subsidy — Design Spec

**Date:** 2026-05-16
**Status:** Approved
**Owner:** candratama

## Summary

Allow users to cover an overspent budget by transferring allocation from another budget within the same month. The transfer is manual, recorded in a dedicated `budget_subsidies` table, fully editable/deletable, and displayed in the UI alongside the original limit so users see both the as-planned and the as-subsidized state.

## Motivation

Today, if a user overspends in one budget (e.g., Food = 1.2M IDR spent against 1M limit), they have no in-app mechanism to indicate that the overage is intentional and being covered by another category's underspend (e.g., Transport at 300/500K). The user only sees a red over-budget bar, which is noisy and not actionable. The subsidy feature lets them explicitly reallocate slack from other budgets to cover the gap, preserving both the planned and the realized state for review.

## Decisions

| # | Question | Choice |
|---|----------|--------|
| 1 | Storage semantics | New `budget_subsidies` table (separate from `transactions`) |
| 2 | Trigger | Manual only |
| 3 | When allowed | Only when target budget is overspent; source must have remaining unallocated room |
| 4 | Multiple sources | Single source per subsidy record; multiple records allowed |
| 5 | UI display | Dual — show both original and effective limits |
| 6 | Edit/delete | Editable (`amountCents`, `note`) and deletable |

## Data Model

New table `budget_subsidies` in `src/lib/server/db/schema.ts`:

```ts
export const budgetSubsidies = sqliteTable(
  'budget_subsidies',
  {
    id: cuid().primaryKey(),
    userId: userIdFk(),
    periodMonth: text('period_month').notNull(),     // 'YYYY-MM'
    fromBudgetId: text('from_budget_id')
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    toBudgetId: text('to_budget_id')
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents', { mode: 'number' }).notNull(),
    note: text('note'),
    createdAt: epochMsNow('created_at'),
    updatedAt: epochMsNow('updated_at')
  },
  (t) => [
    index('subsidies_user_period_idx').on(t.userId, t.periodMonth),
    index('subsidies_from_idx').on(t.fromBudgetId),
    index('subsidies_to_idx').on(t.toBudgetId)
  ]
);
```

**Notes:**
- `fromBudgetId` / `toBudgetId` reference `budgets.id` directly (not `categoryId`) because budgets are period-scoped and subsidies inherit that scoping. Deleting either budget cascades to subsidy rows.
- `periodMonth` is denormalized for fast per-month filtering without joining `budgets`.
- `amountCents` is always positive; reversing a subsidy = delete + re-create.

Migration: add a new Drizzle migration file `drizzle/0009_add_budget_subsidies.sql` containing the table and indexes.

## Validation Rules

Defined in `src/lib/validation/subsidy.ts` (Zod) and enforced again in repository layer.

**Create:**
- `fromBudgetId !== toBudgetId`
- Both budgets exist, belong to user, share the same `periodMonth`
- `amountCents > 0`, integer cents
- Target overspent: `spent(toBudget) > toBudget.limitCents`
- Source has remaining slack: `sourceRemaining > 0`, where
  ```
  sourceRemaining = fromBudget.limitCents
                  - spent(fromBudget)
                  - SUM(subsidies WHERE fromBudgetId = source AND id != currentId)
  ```
- Amount cap: `amountCents <= min(targetOverage, sourceRemaining)`, where
  ```
  targetOverage = spent(toBudget) - toBudget.limitCents
                - SUM(subsidies WHERE toBudgetId = target AND id != currentId)
  ```
- `note` optional, max 200 characters

**Update:**
- Only `amountCents` and `note` are editable. `fromBudgetId` and `toBudgetId` are immutable — ignored if present in payload.
- The "target overspent" check is **dropped** for update (a user adjusting an existing subsidy down should not be blocked just because the target is now balanced). To remove a subsidy entirely, the user deletes it.
- All other create validations apply, treating the current record as excluded from sums:
  - `amountCents > 0`
  - `amountCents <= sourceRemaining_excluding_self`, where
    ```
    sourceRemaining_excluding_self = fromBudget.limitCents
                                   - spent(fromBudget)
                                   - SUM(subsidies WHERE fromBudgetId = source AND id != currentId)
    ```
  - `note` ≤ 200 chars

**Delete:**
- No additional constraints. FK cascade handles budget deletion.

## Repositories

### `src/lib/server/repositories/subsidies.ts` (new)

```ts
listSubsidies(db, userId, { periodMonth }): SubsidyRow[]
getSubsidy(db, userId, id): SubsidyRow | null
createSubsidy(db, userId, input: SubsidyCreateInput): SubsidyRow | { error: string }
updateSubsidy(db, userId, input: SubsidyUpdateInput): SubsidyRow | { error: string }
deleteSubsidy(db, userId, id): SubsidyRow | null
```

### `src/lib/server/repositories/budget-effective.ts` (new)

```ts
// Aggregate per-budget subsidy flows for a period.
// Returns Map<budgetId, { in: number; out: number }>
computeSubsidyFlows(db, userId, periodMonth): Map<string, { in: number; out: number }>
```

### `src/lib/utils/budget.ts` (new, shared client/server util)

```ts
function effectiveLimit(
  limitCents: number,
  flow: { in: number; out: number }
): number {
  return limitCents + flow.in - flow.out;
}
```

## Server Actions

In `src/routes/(app)/budgets/+page.server.ts`, extend `actions`:

```ts
subsidize: async ({ request, locals }) => { ... }
updateSubsidy: async ({ request, locals }) => { ... }
deleteSubsidy: async ({ request, locals }) => { ... }
```

Each parses `FormData`, validates via Zod, calls the repository function, returns `{ type: 'success' }` or `fail(400, { message })`.

The budget detail page (`src/routes/(app)/budgets/[id]/+page.server.ts`) does **not** duplicate these actions. Its UI forms POST to the parent `/budgets?/<action>` endpoint and rely on `invalidateAll()` after success.

## Page Loads

`src/routes/(app)/budgets/+page.server.ts` `load` returns, in addition to existing fields:

- `subsidies: SubsidyRow[]` — all subsidies in the active period
- `subsidyFlowByBudget: Record<budgetId, { in: number; out: number }>` — precomputed map for UI

`src/routes/(app)/budgets/[id]/+page.server.ts` `load` adds:

- `subsidiesIn: SubsidyRow[]` — where `toBudgetId === params.id`
- `subsidiesOut: SubsidyRow[]` — where `fromBudgetId === params.id`
- `periodBudgets: BudgetWithFlow[]` — all budgets in the same period with their `subsidyFlowByBudget` entries, so the detail page can show the same source picker logic

**Eligible sources** for the subsidy create form are **derived client-side** from `data.budgets` + `data.spentByCategory` + `data.subsidyFlowByBudget`. A budget is eligible iff:

```
budget.id !== target.id
&& (budget.limitCents - spent(budget) - flow.out) > 0
```

This avoids duplicating the eligibility computation on the server for each potential target.

## UI — Budgets List Page

File: `src/routes/(app)/budgets/+page.svelte`

### Card derived state

```
over            = spent > limit
flow            = subsidyFlowByBudget[budget.id]
effLimit        = effectiveLimit(limit, flow)
coveredByEff    = spent <= effLimit
stillOver       = spent > effLimit
```

### Dual progress bar

- Background: 100% width = original `limit` (faded base).
- Foreground bar: width relative to `effLimit`.
- Spend fill colors:
  - `stillOver` → amber up to `effLimit`, rose for overflow
  - `coveredByEff` (was over, now covered) → emerald
  - `!over` → emerald/amber by threshold (existing behavior)
- A thin vertical marker at the position of the original `limit` (when `effLimit !== limit`) shows the planned-vs-effective boundary.

### Labels under bar

For a budget with `subsidyIn > 0`:
```
1.2jt of 1jt (eff 1.2jt — disubsidi 200rb dari Transportasi)
100% used (eff)
```

For a budget with `subsidyOut > 0`:
```
300rb of 500rb (eff 300rb — subsidi 200rb ke Makan)
```

### "Subsidi" button

Render on cards where `stillOver === true`. Disabled with tooltip when no other budget in the same period has `sourceRemaining > 0`. Clicking opens the create dialog/sheet with `toBudgetId` pre-filled.

### Subsidy list (collapsible)

On cards with any `subsidyIn` or `subsidyOut`, a small collapsible footer:
```
[chevron] 2 subsidi aktif
  ↓ 200rb dari Transportasi   [edit] [hapus]
  ↑ 100rb ke Hiburan          [edit] [hapus]
```
Default collapsed.

### Summary section

Existing "Spent vs Budget" card retains its numbers (subsidies are zero-sum in the total). Add a subtle line: `"Subsidi aktif: N record, total Xrb dipindahkan."`

## UI — Budget Detail Page

File: `src/routes/(app)/budgets/[id]/+page.svelte`

### Header

Show effective vs original when a subsidy is present:
```
Limit: 1jt  [+200rb disubsidi]  → eff 1.2jt
```

### Subsidy panel

A new section between the header and the transaction list:
```
┌─ Subsidi ──────────────────────────────┐
│ Masuk (200rb dari Transportasi)        │
│   • 200rb — "tutup makan akhir bulan"  │
│       [edit] [hapus]                   │
│                                        │
│ Keluar — (jika ada)                    │
│                                        │
│ [+ Subsidi dari budget lain]           │
└────────────────────────────────────────┘
```

"+ Subsidi" button visible only when this budget is overspent and eligible sources exist.

Transaction list is not affected; subsidies are not transactions.

## UI — Subsidy Dialog / Sheet

Pattern follows existing budget create/edit: `Dialog` on desktop, bottom `Sheet` on mobile (driven by existing `isDesktop` `MediaQuery`).

### Create

Pre-fills `toBudgetId` from the card or detail context.

```
┌─ Subsidi budget Makan ─────────────────┐
│ Kekurangan: 300rb (1.2jt - 1jt)        │
│ Sudah disubsidi: 0rb                   │
│ Sisa yang bisa ditutup: 300rb          │
│                                         │
│ Sumber                                  │
│ [PickerSheet — eligible sources]        │
│                                         │
│ Jumlah                                  │
│ [MoneyInput, auto-cap]                  │
│ Maks: 200rb                             │
│                                         │
│ Catatan (opsional)                      │
│ [Input]                                 │
│                                         │
│ [Cancel] [Subsidi]                      │
└─────────────────────────────────────────┘
```

Sources shown in picker: only those with `sourceRemaining > 0`. Selecting a source updates the displayed max to `min(remainingOverageToCover, source.sourceRemaining)`. Submit disabled until source + amount are set.

### Edit

```
┌─ Edit subsidi ─────────────────────────┐
│ 200rb dari Transportasi → Makan        │
│ (from/to tidak bisa diubah)            │
│                                         │
│ Jumlah                                  │
│ [MoneyInput]                            │
│ Maks: 300rb                             │
│                                         │
│ Catatan                                 │
│ [Input]                                 │
│                                         │
│ [Cancel] [Simpan]                       │
└─────────────────────────────────────────┘
```

Max for edit = `sourceRemaining + currentAmount` (current record excluded from the sum).

### Delete

Inline action in the subsidy list row; POST form to `?/deleteSubsidy` with `invalidateAll()`. No modal confirmation — matches budget delete pattern in existing code.

## Edge Cases

| Case | Behavior |
|------|----------|
| Budget deleted while referenced by a subsidy | FK cascade removes the subsidy row. UI re-renders from fresh data. |
| New spending on a source after subsidy makes the source itself overspent | Allowed. Source becomes a new overspent card; user may subsidize it from another budget. |
| User edits source budget limit downward such that `sourceRemaining < 0` | Allowed. Show a warning on the source card ("subsidi melebihi limit baru"). User resolves manually. |
| Subsidy across different `periodMonth`s | Rejected at validation. |
| Multiple budgets for the same category across different periods | No conflict; subsidy references `budgetId`. |
| Multi-currency | Out of scope; current app assumes a single user currency. |
| Demo seed | Add 1–2 sample subsidy rows in `src/lib/server/demo-seed.ts` so the feature appears for new demo accounts. |

## Testing

Mirroring existing test pattern (`budgets.test.ts`, `budget-spent.test.ts`).

- `src/lib/validation/subsidy.test.ts` — Zod coverage
- `src/lib/server/repositories/subsidies.test.ts` — CRUD + cascade + validation rejection paths
- `src/lib/server/repositories/budget-effective.test.ts` — `computeSubsidyFlows` aggregation
- `src/lib/utils/budget.test.ts` — `effectiveLimit` arithmetic

No e2e tests added; the project does not currently have an e2e framework wired up. Manual verification via dev server + browser for the dual progress bar and dialog flows.

## Out of Scope

- Auto-distribution rules (Q2 option B)
- Multi-source-in-one-form UI (Q4 option B)
- Cross-period subsidies
- Multi-currency conversion
- Approval / multi-user workflows
