# Mavlo Phase 12 — Mobile-First UX Design

**Date:** 2026-04-26
**Branch:** `claude/phase12-mobile-ux`
**Goal:** Make Mavlo feel native on mobile. Reduce friction recording transactions, hide secondary chrome, replace clunky form controls with mobile-native pickers and segmented controls. Add adjustable monthly cycle (payday) for users whose financial month does not align with calendar month.

**Tech stack:** SvelteKit 2.57, Svelte 5 (runes), Tailwind v4, shadcn-svelte, bits-ui, lucide-svelte, drizzle (D1).

## Scope

In: All `(app)` routes — Dashboard, Transactions, Accounts, Budgets, Categories, Settings. Layout shell. Three new shared primitives. One DB column + cycle helper.

Out: Recurring transactions, multi-currency conversion, offline/SW, icon picker, account currency picker, heading typography sweep, historical budget reinterpretation backfill.

---

## Section 1 — Architecture & Shared Primitives

Three new components in `src/lib/components/ui/`:

### `SegmentedControl`
Pill-style group of 2-3 mutually exclusive options. Used for: transaction kind (Expense | Income | Transfer), category kind (Income | Expense), theme (Light | Dark | System).

- Props: `options: { value: string; label: string; icon?: Component }[]`, `value: string` (`$bindable`), `name?: string`, `class?: string`.
- Accessibility: `role="radiogroup"`, items `role="radio"` with `aria-checked`. Arrow keys move selection (left/right).
- Visual: rounded `bg-muted` track, active item `bg-background shadow-sm font-medium`. Equal-width grid columns.

### `PickerSheet`
Bottom-sheet picker for long lists. Used for: account, category (grouped), account-type, transferTo, currency.

- Props: `items: PickerItem[]` where `PickerItem = { value: string; label: string; description?: string; icon?: Component }`, `value: string` (`$bindable`), `placeholder: string`, `searchable?: boolean`, `groups?: { label: string; items: PickerItem[] }[]` (overrides flat items when present), `disabled?: boolean`.
- Renders as a button that displays current selection (or placeholder). Tap → opens `Sheet side="bottom"` with header (title), optional search `Input` (autofocus when searchable), scrollable list, tap-to-select.
- Selecting an item closes the sheet and updates `value`.
- Keyboard: search input gets focus on open; arrow keys move highlight; Enter selects.
- For form submission, parent renders a hidden `<input type="hidden" name="..." value={picked}>`.

### `Fab`
Floating action button. Single global instance in `(app)/+layout.svelte`.

- Position: `fixed right-4 bottom-[calc(var(--bottom-nav-h)+1rem+env(safe-area-inset-bottom))] z-30`.
- Visibility: `md:hidden` (mobile only — desktop has dedicated New buttons).
- Action: opens Add-Transaction sheet via shared store (`src/lib/stores/add-transaction.ts` exposing a `$state` `open` flag and `kind` default).
- Visual: `size-14 rounded-full bg-primary text-primary-foreground shadow-lg`, lucide `Plus` icon `size-6`.

### Add-transaction store
`src/lib/stores/add-transaction.ts` — module-scoped Svelte 5 `$state` exposing `open: boolean` and `defaultKind?: 'expense' | 'income' | 'transfer'`. The `(app)/+layout.svelte` mounts a single `AddTransactionSheet` listening to this store so Fab + Transactions page header can both trigger the same sheet without prop-drilling.

### `lib/utils/last-used.ts`
SSR-safe localStorage wrapper:

```ts
const KEY = 'mavlo:last-used';
type LastUsed = { accountId?: string; kind?: 'income' | 'expense' | 'transfer' };
export const getLastUsed = (): LastUsed => { ... };
export const setLastUsed = (next: Partial<LastUsed>): void => { ... };
```

Guard with `typeof window === 'undefined'` for SSR.

---

## Section 2 — Add/Edit Transaction Flow

**Mobile (`< md`):** `Sheet side="bottom"` full-height (`h-[90dvh]`).
**Desktop (`md+`):** Existing `Dialog` reused, same internal layout but compressed.

### Layout (top → bottom inside sheet/dialog)

1. **Header** — title ("New transaction" / "Edit transaction") + close X.
2. **Kind segmented** — `[Expense | Income | Transfer]`. Default Expense for new (per Q4-B). Edit: pre-selected.
3. **Amount hero**
   - `MoneyInput` styled `text-3xl tabular-nums font-semibold h-14 px-4` on mobile (`text-2xl h-12` desktop).
   - Currency code shown as small label above (`text-xs text-muted-foreground`) reflecting the chosen account's currency.
   - Autofocus on open. `inputmode="decimal"`.
4. **Account picker row**
   - `PickerSheet` showing all active accounts.
   - Default = `getLastUsed().accountId` if it exists in the list, else first account.
   - For Transfer: two stacked rows — "From account" and "To account". Both required.
5. **Category picker row**
   - `PickerSheet` with `groups=[{label:'Expense', items:expenseCats}, {label:'Income', items:incomeCats}]`.
   - Hidden when kind = Transfer.
   - Optional: includes a leading "None" item.
6. **Date chip** — pill labeled `"Today"` when `occurredAt === todayYmd`, else `"Mar 12, 2026"`. Tap toggles a hidden native `<input type="date">` (positioned absolute over the chip, opacity 0). Native picker handles input.
7. **`+ Add note` toggle** — collapsed by default. Tap reveals `Input` (`maxlength=200`) with `Trash` icon button to remove. State persists for the session of the open sheet.
8. **Footer** — sticky bottom. Mobile: full-width `Save` button. Desktop: `[Cancel] [Save]` row right-aligned.

### Form submission
- Existing `?/create` and `?/update` form actions unchanged.
- Hidden `<input>` elements mirror picker values: `accountId`, `transferToAccountId`, `categoryId`, `kind`, `occurredAt`, `note`, `amountCents`.
- On successful submit, write `setLastUsed({ accountId, kind })`.

### Validation
- Submit disabled until amount > 0 and required pickers populated.
- For Transfer: `accountId !== transferToAccountId`.
- Errors surface via existing `notify.error(message)` toast pattern.

---

## Section 3 — Filters (Transactions + Budgets)

### Transactions filter

**Mobile (`< md`):**
- Replace inline 5-field grid with a chip bar above the transactions list.
- No active filters → single ghost button: `[⚙ Filter]`.
- Active filters → chips for each populated param (`From: Sep 1`, `To: Sep 30`, `Account: BCA`, `Category: Food`, `Kind: Expense`). Each chip has a small `×` to clear that param (navigates to URL without it). Trailing `[⚙ Edit]` chip opens the full filter sheet.
- **Filter sheet** = `Sheet side="bottom"`. Contains the 5 fields:
  - From, To: native `<input type="date">`.
  - Account: `PickerSheet` (with leading "All" item).
  - Category: `PickerSheet` grouped (with leading "All" item).
  - Kind: `SegmentedControl` `[All | Income | Expense | Transfer]`.
  - Footer: `[Reset]` (clears all params) and `[Apply]` (submits the form, which triggers GET navigation).

**Desktop (`md+`):**
- Keep current 6-col grid form, but use new `SegmentedControl` for Kind and `PickerSheet` for Account/Category. From/To remain native date inputs.

### Budgets filter

**Mobile (`< md`):**
- Replace card with chip bar: `[Sep 2026]` chip → tap = native `<input type="month">`.
- "Apply" trigger fires on change (auto-submit) since there's only one field.

**Desktop (`md+`):**
- Replace text `Input` with native `<input type="month">` for `period`. Apply button kept.

URL params unchanged (`?from=&to=&account=&category=&kind=`, `?period=`). All filter logic stays server-side via existing GET form pattern.

---

## Section 4 — Per-Page Polish

### Dashboard (`/dashboard`)
- KPI cards: `Card.Title` `text-2xl` → `text-xl` on mobile (`sm:text-2xl` keeps desktop). `Card.Header` `p-4` → `p-3` on mobile.
- Charts unchanged (Phase 11 already responsive).
- Recent list: `px-6` → `px-4` on mobile.

### Transactions (`/transactions`)
- Filter → chip bar (Section 3).
- Add/Edit → bottom sheet on mobile, dialog on desktop (Section 2).
- "New transaction" header button → `hidden md:inline-flex` (FAB takes over mobile).
- Mobile list rows unchanged (already cards from Phase 11).

### Accounts (`/accounts`)
- Create/Edit dialog → bottom sheet on mobile.
- `Type` native select → `PickerSheet` with lucide icons:
  - Cash → `Coins`, Bank → `Landmark`, Credit → `CreditCard`, Wallet → `Wallet`, Other → `CircleEllipsis`.
- `Initial balance` → hero amount style (`text-2xl h-12` on mobile, full-width row).
- Currency stays `Input` (8-char) for now.

### Budgets (`/budgets`)
- Filter → period chip (Section 3).
- Create/Edit dialog → bottom sheet on mobile.
- `Category` native select → `PickerSheet`.
- `Period (YYYY-MM)` text input → `<input type="month">`.
- `Limit` → hero amount style.

### Categories (`/categories`)
- Create/Edit dialog → bottom sheet on mobile.
- `Kind` (income/expense) native select → `SegmentedControl`.
- `Color (hex)` input → swatch grid + `[+ Custom]` expander:
  - 8 preset swatches (`size-8 rounded-lg` buttons): emerald `#10b981`, blue `#3b82f6`, amber `#f59e0b`, rose `#f43f5e`, violet `#8b5cf6`, pink `#ec4899`, teal `#14b8a6`, orange `#f97316`.
  - Selected swatch shows `ring-2 ring-foreground`.
  - `[+ Custom]` button reveals hex `Input` with live preview swatch.
- `Icon` text input unchanged.

### Settings (`/settings`)
- `Theme` select → `SegmentedControl` `[Light | Dark | System]`.
- New field: `Month start day` (Section 5).
- Form fields use `space-y-4` consistent with other pages.
- Any present modal → bottom sheet on mobile.

### Layout (`(app)/+layout.svelte`)
- Mount global `Fab` (mobile-only, `hidden md:hidden` redundant — handled inside).
- Mount global `AddTransactionSheet` listening to add-transaction store.
- "+ New X" header buttons on Accounts/Budgets/Categories pages: kept on mobile (page-specific creates; FAB is transactions-only).

---

## Section 5 — Adjustable Month Start Day (Payday Cycle)

### Data
- New column on `userPreferences`:
  ```ts
  monthStartDay: integer('month_start_day', { mode: 'number' }).notNull().default(1)
  ```
- Range: 1-28 (capped at 28 to avoid Feb edge cases).
- Migration via drizzle-kit (`npm run db:generate` then `npm run db:push`).

### Helper — `src/lib/utils/cycle.ts`

```ts
export interface Cycle { start: Date; end: Date; label: string; periodMonth: string; }

// Cycle containing `now` for given startDay. UTC-based.
export function getCurrentCycle(now: Date, startDay: number, timezone: string): Cycle;

// Cycle for a given period anchor (e.g. "2026-09" with startDay=25 → Sep 25 → Oct 24).
export function getCycleForPeriod(periodYYYYMM: string, startDay: number, timezone: string): Cycle;

// Format a cycle label: "September 2026" if startDay=1, "Sep 25 – Oct 24" otherwise.
export function formatCycleLabel(cycle: Cycle, startDay: number, locale?: string): string;
```

Implementation rules:
- All math in UTC ms; convert to user's timezone only for display via `Intl.DateTimeFormat`.
- `start` = day `startDay` of the anchor month at 00:00 in user's timezone.
- `end` = day `startDay` of next month at 00:00 (exclusive), so range is half-open `[start, end)`.
- For `startDay=1`, behavior is exactly calendar month.

### Server queries updated

`src/routes/(app)/dashboard/+page.server.ts`:
- `monthExpenseCents`, `monthIncomeCents`, `dailySpending`, `spendingByCategory` — replace calendar-month boundary calculations with `getCurrentCycle(now, prefs.monthStartDay, prefs.timezone)`.

`src/routes/(app)/transactions/+page.server.ts`:
- When neither `from` nor `to` query param present, default range = current cycle.

`src/routes/(app)/budgets/+page.server.ts`:
- `spentByCategory` map keyed by budget — interpret each budget's `periodMonth` via `getCycleForPeriod(periodMonth, prefs.monthStartDay, prefs.timezone)` and sum transactions whose `occurredAt` falls in the cycle's `[start, end)`.
- Default `periodMonth` for new budgets = current cycle's `periodMonth` (anchor month, not calendar month).

### Settings UI
Add to `/settings` form:

```svelte
<div class="space-y-1">
  <Label for="month-start-day">Cycle start (e.g. payday)</Label>
  <Input
    id="month-start-day"
    type="number"
    name="monthStartDay"
    min="1"
    max="28"
    value={prefs.monthStartDay}
  />
  <p class="text-xs text-muted-foreground">
    Day 1 = calendar month. Day 25 = your month runs 25th to 24th. Affects current and future periods.
  </p>
</div>
```

Validation in form action: clamp to 1-28, reject otherwise.

### Display copy
- Dashboard "This month spending" `Card.Description` → shows cycle label dynamically (e.g. "Sep 25 – Oct 24" when non-1, else "September 2026").
- Budgets page subtitle when `monthStartDay !== 1`: `"Period {periodMonth} ({cycleLabel})"`.

### Constraints
- Existing budget rows are not migrated — they continue to use `periodMonth` strings, but the boundary interpretation shifts forward when the user changes `monthStartDay`. Documented in Settings copy.

---

## Section 6 — Testing & Verification

### Unit tests (vitest, jsdom)

**`lib/utils/cycle.test.ts`** — covers:
- `startDay=1` returns calendar month boundaries.
- `startDay=25` mid-month start returns `prev-25 → curr-25` for `now` before the 25th, `curr-25 → next-25` after.
- Feb edge: anchored to user's timezone, never overshoots Feb 28.
- DST boundary: explicit test crossing March/November DST transitions in non-UTC timezone (e.g. America/New_York). Document if Mavlo only supports Asia/Jakarta (no DST) — in that case, DST test is informational only.
- `getCycleForPeriod('2026-09', 25, 'Asia/Jakarta')` = `[2026-09-25, 2026-10-25)`.
- Label formatting for both cases.

**`lib/utils/last-used.test.ts`** — covers:
- SSR safety: import + call functions when `window` undefined returns sane defaults / no-op.
- get/set roundtrip in jsdom.
- Malformed JSON returns defaults.

### Component tests (jsdom, where reasonable)

**`SegmentedControl.test.ts`** — selection updates via click; arrow keys move; aria-checked correct.
**`PickerSheet.test.ts`** — open/close, search filter narrows items, item click fires callback + closes sheet, keyboard arrow + Enter selection.

### Integration verification (manual via dev server, documented in plan)

- Add transaction sheet on iPhone SE 375×667, iPad 768, desktop 1440. Verify autofocus, segmented, picker open/close, FAB launches it.
- Filter chip bar: add/remove chips updates URL params; sheet apply/reset works.
- Cycle change in Settings → Dashboard "This month" recomputes to new cycle.
- FAB above bottom nav, hidden md+, opens sheet from any page.
- Categories swatch picker: select preset, expand custom, paste hex.

### Type-check + lint
- `npm run check` and `npm run lint` clean for new files. Pre-existing baseline errors unchanged (Phase 11 acknowledged 1 type error + 38 lint errors pre-existing).

---

## Section 7 — Dependencies, Risks, Out-of-Scope

### Dependencies
None added at the package level. All built on existing bits-ui, shadcn-svelte, lucide-svelte, Tailwind v4. One drizzle migration adds `month_start_day` column.

### Risks
- **Cycle math + timezone** — easy to get off-by-one. Mitigated by exhaustive unit tests covering startDay=1, mid-month starts, Feb boundaries, period anchor edges.
- **localStorage SSR** — guarded with `typeof window` check in `last-used.ts`.
- **PickerSheet keyboard** — bits-ui Sheet handles focus trap; search input gets autofocus when `searchable=true`.
- **FAB z-index layering** — must sit above bottom nav (`z-40`) and below open sheet/dialog (`z-50`). FAB = `z-30`.
- **Existing budgets reinterpreted** — users with `monthStartDay ≠ 1` will see existing budgets shifted to the new cycle. Documented in Settings copy.
- **Migration safety** — adding a NOT NULL column with default to a table; D1 supports this without locking.

### Out of scope
- Recurring / scheduled transactions
- Multi-currency conversion display
- Skeleton loading / offline / service worker
- Icon picker for categories (text input retained)
- Account currency picker (text input retained)
- Heading typography sweep beyond page titles
- Backfilling historical budget periods after a cycle change

---

## File Inventory

### New files
- `src/lib/components/ui/segmented-control.svelte`
- `src/lib/components/ui/picker-sheet.svelte`
- `src/lib/components/ui/fab.svelte`
- `src/lib/components/forms/add-transaction-sheet.svelte`
- `src/lib/stores/add-transaction.ts`
- `src/lib/utils/last-used.ts`
- `src/lib/utils/last-used.test.ts`
- `src/lib/utils/cycle.ts`
- `src/lib/utils/cycle.test.ts`
- `src/lib/components/ui/segmented-control.test.ts`
- `src/lib/components/ui/picker-sheet.test.ts`
- Drizzle migration: `drizzle/<timestamped>_month_start_day.sql`

### Modified files
- `src/lib/server/db/schema.ts` — add `monthStartDay` column.
- `src/routes/(app)/+layout.svelte` — mount `Fab` and `AddTransactionSheet` global.
- `src/routes/(app)/dashboard/+page.svelte` — KPI sizing + recent list padding.
- `src/routes/(app)/dashboard/+page.server.ts` — cycle-aware aggregations.
- `src/routes/(app)/transactions/+page.svelte` — chip bar filter, FAB-driven add, sheet for mobile create/edit.
- `src/routes/(app)/transactions/+page.server.ts` — cycle-aware default filter.
- `src/routes/(app)/accounts/+page.svelte` — sheet for mobile create/edit, PickerSheet for type, hero amount.
- `src/routes/(app)/budgets/+page.svelte` — period chip, sheet for mobile create/edit, PickerSheet for category, month input, hero limit.
- `src/routes/(app)/budgets/+page.server.ts` — cycle-aware spent calculation.
- `src/routes/(app)/categories/+page.svelte` — sheet for mobile create/edit, SegmentedControl for kind, swatch grid for color.
- `src/routes/(app)/settings/+page.svelte` — SegmentedControl for theme, new monthStartDay field, mobile sheet for any modals.
- `src/routes/(app)/settings/+page.server.ts` — accept + validate monthStartDay.
