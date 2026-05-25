# Financial Health Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add debt-aware Financial Health dashboard metrics and fixed/variable expense classification.

**Architecture:** Store expense classification on `categories.expense_type`, compute health metrics in a focused repository function, and render a new dashboard card from layout data. Keep rules deterministic and local: no AI, no new budget flow, no debt payoff logic.

**Tech Stack:** SvelteKit 2, Svelte 5, Drizzle ORM, Cloudflare D1 SQLite, Vitest, Tailwind/shadcn-svelte.

---

## File Structure

- Modify `src/lib/server/db/schema.ts`
  - Add `expenseType` to `categories` table with enum `fixed | variable`, nullable/default `variable` to keep income categories simple.
- Create `drizzle/0014_category_expense_type.sql`
  - Add DB column and backfill fixed categories.
- Modify `drizzle/meta/_journal.json`
  - Register migration if repo migration metadata requires it.
- Modify generated snapshots only if this repo tracks snapshots manually for migrations.
- Modify `src/lib/server/db/test-fixtures.ts`
  - Ensure in-memory schema includes new `expense_type` column.
- Modify `src/lib/server/repositories/dashboard-stats.ts`
  - Add `computeFinancialHealth()` and exported types.
- Modify `src/lib/server/repositories/dashboard-stats.test.ts`
  - Add TDD tests for half-open range, real income exclusions, fixed/variable split, status, top leaks.
- Modify `src/routes/(app)/+layout.server.ts`
  - Load financial health via repository function and expose `financialHealth`.
  - Change current cycle tx filters to half-open if touched.
- Modify `src/routes/(app)/dashboard/+page.svelte`
  - Render Financial Health card.
- Modify `src/routes/(app)/categories/+page.server.ts`
  - Persist `expenseType` in create/edit actions for expense categories.
- Modify `src/routes/(app)/categories/+page.svelte`
  - Add fixed/variable selector to expense category create/edit forms.
- Modify `src/routes/(app)/categories/[id]/+page.server.ts` and/or `+page.svelte` if detail edit page has category edit form.

---

### Task 1: Add category expense_type schema + migration

**Files:**
- Modify: `src/lib/server/db/schema.ts:38-52`
- Create: `drizzle/0014_category_expense_type.sql`
- Modify: `src/lib/server/db/test-fixtures.ts`

- [ ] **Step 1: Write failing schema-backed repository test setup**

Open `src/lib/server/repositories/dashboard-stats.test.ts`. Update the `beforeEach` category inserts to include `expense_type` now, before schema change exists:

```ts
h.sqlite
	.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
	.run('cat-food', h.userId, 'Food', 'expense', 'variable', now, now);
h.sqlite
	.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
	.run('cat-transport', h.userId, 'Transport', 'expense', 'variable', now, now);
```

Expected fail before implementation: SQLite insert column mismatch or schema missing `expense_type`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/lib/server/repositories/dashboard-stats.test.ts --run
```

Expected: FAIL because `categories` schema/test table does not yet accept `expense_type`.

- [ ] **Step 3: Add Drizzle schema column**

In `src/lib/server/db/schema.ts`, change category table fields to:

```ts
export const categories = sqliteTable(
	'categories',
	{
		id: cuid().primaryKey(),
		userId: userIdFk(),
		name: text('name').notNull(),
		kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
		expenseType: text('expense_type', { enum: ['fixed', 'variable'] }).notNull().default('variable'),
		color: text('color'),
		icon: text('icon'),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
		sortOrder: integer('sort_order', { mode: 'number' }).notNull().default(0),
		createdAt: epochMsNow('created_at'),
		updatedAt: epochMsNow('updated_at')
	},
	(t) => [index('categories_user_idx').on(t.userId)]
);
```

- [ ] **Step 4: Add D1 migration**

Create `drizzle/0014_category_expense_type.sql`:

```sql
ALTER TABLE categories ADD COLUMN expense_type text NOT NULL DEFAULT 'variable';

UPDATE categories
SET expense_type = 'fixed'
WHERE kind = 'expense'
  AND name IN ('Home Rent', 'Internet', 'Electricity', 'Monthly Service', 'Debt Payment');
```

- [ ] **Step 5: Update test fixture schema**

Open `src/lib/server/db/test-fixtures.ts`. Find the `CREATE TABLE categories` statement. Add:

```sql
expense_type text NOT NULL DEFAULT 'variable',
```

immediately after `kind text NOT NULL,`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm run test -- src/lib/server/repositories/dashboard-stats.test.ts --run
```

Expected: existing dashboard-stats tests pass after insert statements and fixture schema match.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/test-fixtures.ts src/lib/server/repositories/dashboard-stats.test.ts drizzle/0014_category_expense_type.sql
git commit -m "feat(db): classify expense categories"
```

---

### Task 2: Implement financial health repository function with TDD

**Files:**
- Modify: `src/lib/server/repositories/dashboard-stats.ts`
- Modify: `src/lib/server/repositories/dashboard-stats.test.ts`

- [ ] **Step 1: Write failing tests for financial health**

Add import in `dashboard-stats.test.ts`:

```ts
import {
	computeSpendingByCategory,
	computeDailySpending,
	computeMonthlyIncomeExpense,
	computeFinancialHealth
} from './dashboard-stats';
```

Extend setup with income categories and one fixed expense category:

```ts
h.sqlite
	.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
	.run('cat-rent', h.userId, 'Home Rent', 'expense', 'fixed', now, now);
h.sqlite
	.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
	.run('cat-salary', h.userId, 'Salary', 'income', 'variable', now, now);
h.sqlite
	.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
	.run('cat-loan', h.userId, 'Loan Proceeds', 'income', 'variable', now, now);
h.sqlite
	.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
	.run('cat-adjust', h.userId, 'Balance Adjustment', 'income', 'variable', now, now);
```

Change `insertTx` kind type to include transfer only if needed:

```ts
kind: 'income' | 'expense' | 'transfer',
```

Add tests:

```ts
describe('computeFinancialHealth', () => {
	it('uses half-open cycle boundaries and excludes next-cycle salary', async () => {
		insertTx('salary-apr', 'cat-salary', 'income', 8_000_000, Date.UTC(2026, 3, 25));
		insertTx('salary-may', 'cat-salary', 'income', 8_000_000, Date.UTC(2026, 4, 25));
		insertTx('rent', 'cat-rent', 'expense', 1_000_000, Date.UTC(2026, 3, 26));

		const health = await computeFinancialHealth(h.db, h.userId, '2026-04', 25, 'UTC');

		expect(health.grossIncomeCents).toBe(8_000_000);
		expect(health.expenseCents).toBe(1_000_000);
		expect(health.realNetCents).toBe(7_000_000);
	});

	it('excludes loan proceeds and balance adjustments from real income', async () => {
		insertTx('salary', 'cat-salary', 'income', 8_000_000, Date.UTC(2026, 3, 25));
		insertTx('loan', 'cat-loan', 'income', 1_150_000, Date.UTC(2026, 4, 21));
		insertTx('adjust', 'cat-adjust', 'income', 21_543, Date.UTC(2026, 4, 24));
		insertTx('food', 'cat-food', 'expense', 2_000_000, Date.UTC(2026, 4, 1));

		const health = await computeFinancialHealth(h.db, h.userId, '2026-04', 25, 'UTC');

		expect(health.grossIncomeCents).toBe(9_171_543);
		expect(health.excludedIncomeCents).toBe(1_171_543);
		expect(health.realIncomeCents).toBe(8_000_000);
		expect(health.realNetCents).toBe(6_000_000);
	});

	it('splits fixed and variable expenses and prefers variable top leaks', async () => {
		insertTx('salary', 'cat-salary', 'income', 10_000_000, Date.UTC(2026, 3, 25));
		insertTx('rent', 'cat-rent', 'expense', 5_000_000, Date.UTC(2026, 3, 26));
		insertTx('food', 'cat-food', 'expense', 2_500_000, Date.UTC(2026, 4, 1));
		insertTx('transport', 'cat-transport', 'expense', 1_500_000, Date.UTC(2026, 4, 2));

		const health = await computeFinancialHealth(h.db, h.userId, '2026-04', 25, 'UTC');

		expect(health.fixedExpenseCents).toBe(5_000_000);
		expect(health.variableExpenseCents).toBe(4_000_000);
		expect(health.topLeaks).toEqual([
			{ categoryId: 'cat-food', categoryName: 'Food', amountCents: 2_500_000, expenseType: 'variable' },
			{
				categoryId: 'cat-transport',
				categoryName: 'Transport',
				amountCents: 1_500_000,
				expenseType: 'variable'
			}
		]);
	});

	it('sets danger warning healthy statuses', async () => {
		insertTx('danger-income', 'cat-salary', 'income', 5_000_000, Date.UTC(2026, 3, 25));
		insertTx('danger-expense', 'cat-food', 'expense', 6_000_000, Date.UTC(2026, 3, 26));
		const danger = await computeFinancialHealth(h.db, h.userId, '2026-04', 25, 'UTC');
		expect(danger.status).toBe('danger');

		insertTx('warning-income', 'cat-salary', 'income', 10_000_000, Date.UTC(2026, 5, 25));
		insertTx('warning-expense', 'cat-food', 'expense', 9_500_000, Date.UTC(2026, 5, 26));
		const warning = await computeFinancialHealth(h.db, h.userId, '2026-06', 25, 'UTC');
		expect(warning.status).toBe('warning');

		insertTx('healthy-income', 'cat-salary', 'income', 10_000_000, Date.UTC(2026, 6, 25));
		insertTx('healthy-expense', 'cat-food', 'expense', 8_500_000, Date.UTC(2026, 6, 26));
		const healthy = await computeFinancialHealth(h.db, h.userId, '2026-07', 25, 'UTC');
		expect(healthy.status).toBe('healthy');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test -- src/lib/server/repositories/dashboard-stats.test.ts --run
```

Expected: FAIL with `computeFinancialHealth` export missing.

- [ ] **Step 3: Add repository types and implementation**

Append to `src/lib/server/repositories/dashboard-stats.ts`:

```ts
export type FinancialHealthStatus = 'healthy' | 'warning' | 'danger';
export type ExpenseType = 'fixed' | 'variable';

export interface FinancialHealthTopLeak {
	categoryId: string;
	categoryName: string;
	amountCents: number;
	expenseType: ExpenseType;
}

export interface FinancialHealthSummary {
	grossIncomeCents: number;
	excludedIncomeCents: number;
	realIncomeCents: number;
	expenseCents: number;
	fixedExpenseCents: number;
	variableExpenseCents: number;
	realNetCents: number;
	status: FinancialHealthStatus;
	topLeaks: FinancialHealthTopLeak[];
}

const excludedIncomeCategoryNames = new Set(['Loan Proceeds', 'Balance Adjustment']);

const statusForFinancialHealth = (
	realIncomeCents: number,
	expenseCents: number,
	realNetCents: number
): FinancialHealthStatus => {
	if (realIncomeCents <= 0) return expenseCents > 0 ? 'danger' : 'warning';
	if (realNetCents < 0) return 'danger';
	if (realNetCents < realIncomeCents * 0.1) return 'warning';
	return 'healthy';
};

export async function computeFinancialHealth(
	db: Db,
	userId: string,
	periodMonth: string,
	monthStartDay: number,
	timezone: string
): Promise<FinancialHealthSummary> {
	const cycle = getCycleForPeriod(periodMonth, monthStartDay, timezone);
	const fromMs = cycle.start.getTime();
	const toMsExclusive = cycle.end.getTime();

	const [txRows, catRows] = await Promise.all([
		db
			.select()
			.from(transactions)
			.where(
				and(
					eq(transactions.userId, userId),
					between(transactions.occurredAt, fromMs, toMsExclusive - 1)
				)
			),
		db.select().from(categories).where(eq(categories.userId, userId))
	]);

	const categoryById = new Map(catRows.map((c) => [c.id, c]));
	let grossIncomeCents = 0;
	let excludedIncomeCents = 0;
	let expenseCents = 0;
	let fixedExpenseCents = 0;
	let variableExpenseCents = 0;
	const expenseTotals = new Map<string, FinancialHealthTopLeak>();

	for (const tx of txRows) {
		const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
		if (tx.kind === 'income') {
			grossIncomeCents += tx.amountCents;
			if (category && excludedIncomeCategoryNames.has(category.name)) {
				excludedIncomeCents += tx.amountCents;
			}
			continue;
		}
		if (tx.kind !== 'expense') continue;

		expenseCents += tx.amountCents;
		const expenseType = category?.expenseType === 'fixed' ? 'fixed' : 'variable';
		if (expenseType === 'fixed') fixedExpenseCents += tx.amountCents;
		else variableExpenseCents += tx.amountCents;

		if (!category) continue;
		const current = expenseTotals.get(category.id);
		if (current) current.amountCents += tx.amountCents;
		else {
			expenseTotals.set(category.id, {
				categoryId: category.id,
				categoryName: category.name,
				amountCents: tx.amountCents,
				expenseType
			});
		}
	}

	const variableLeaks = [...expenseTotals.values()].filter((row) => row.expenseType === 'variable');
	const leakPool = variableLeaks.length > 0 ? variableLeaks : [...expenseTotals.values()];
	const topLeaks = leakPool.sort((a, b) => b.amountCents - a.amountCents).slice(0, 3);
	const realIncomeCents = grossIncomeCents - excludedIncomeCents;
	const realNetCents = realIncomeCents - expenseCents;

	return {
		grossIncomeCents,
		excludedIncomeCents,
		realIncomeCents,
		expenseCents,
		fixedExpenseCents,
		variableExpenseCents,
		realNetCents,
		status: statusForFinancialHealth(realIncomeCents, expenseCents, realNetCents),
		topLeaks
	};
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test -- src/lib/server/repositories/dashboard-stats.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/repositories/dashboard-stats.ts src/lib/server/repositories/dashboard-stats.test.ts
git commit -m "feat(dashboard): compute financial health"
```

---

### Task 3: Wire financial health into layout data

**Files:**
- Modify: `src/routes/(app)/+layout.server.ts`

- [ ] **Step 1: Add failing type/reference usage**

In `src/routes/(app)/+layout.server.ts`, update import from dashboard stats to include:

```ts
computeFinancialHealth
```

Add `financialHealth` to the `Promise.all` destructuring after `monthlyIncomeExpense`:

```ts
financialHealth,
```

Add call after `computeMonthlyIncomeExpense(...)`:

```ts
cachedJson(user.id, CACHE_KEYS.financialHealth(cycle.periodMonth), 60, () =>
	computeFinancialHealth(db, user.id, cycle.periodMonth, monthStartDay, timezone)
),
```

Expected fail: `CACHE_KEYS.financialHealth` missing.

- [ ] **Step 2: Add cache key**

Open `src/lib/server/cf-cache.ts`. Add key function beside dashboard keys:

```ts
financialHealth: (periodMonth: string) => `financial-health:${periodMonth}`,
```

- [ ] **Step 3: Return financialHealth to client**

In layout return object near dashboard stats, add:

```ts
financialHealth,
```

- [ ] **Step 4: Normalize half-open local cycle filters**

In `src/routes/(app)/+layout.server.ts`, change local cycle transaction filters from inclusive end:

```ts
t.occurredAt >= cycleFromMs && t.occurredAt <= cycleToMs
```

to half-open via existing `cycle.end.getTime()`:

```ts
t.occurredAt >= cycleFromMs && t.occurredAt < cycle.end.getTime()
```

Apply to `cycleHasPayment` and `cycleTxns` only.

- [ ] **Step 5: Run checks**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/(app)/+layout.server.ts src/lib/server/cf-cache.ts
git commit -m "feat(dashboard): load financial health"
```

---

### Task 4: Render Financial Health card

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte`

- [ ] **Step 1: Add card state helpers**

In `<script lang="ts">`, after `const trendingUp`, add:

```ts
const healthTone = $derived.by(() => {
	const status = data.financialHealth?.status;
	if (status === 'healthy') return 'from-emerald-500/10 border-emerald-500/20';
	if (status === 'warning') return 'from-amber-500/10 border-amber-500/20';
	return 'from-rose-500/10 border-rose-500/20';
});

const healthLabel = $derived.by(() => {
	const status = data.financialHealth?.status;
	if (status === 'healthy') return 'Healthy';
	if (status === 'warning') return 'Watch';
	return 'Deficit';
});

const healthAdvice = $derived.by(() => {
	const h = data.financialHealth;
	if (!h) return '';
	const top = h.topLeaks.map((x: { categoryName: string }) => x.categoryName).join(', ');
	if (h.realNetCents < 0) {
		return `Defisit riil ${formatCentsAsCurrency(Math.abs(h.realNetCents), data.displayCurrency)}. Kurangi ${top || 'variable expense'} bulan depan.`;
	}
	if (h.status === 'warning') {
		return `Surplus tipis. Jaga variable expense${top ? `: ${top}` : ''}.`;
	}
	return `Cashflow sehat. Pertahankan batas variable expense${top ? `: ${top}` : ''}.`;
});
```

- [ ] **Step 2: Render card below cycle dual-stat**

After the cycle dual-stat block (`</div>` around current Income/Expense cards) and before monthly budget card, insert:

```svelte
{#if data.financialHealth}
	{@const h = data.financialHealth}
	<section class="mt-4 rounded-xl border bg-gradient-to-br {healthTone} via-card to-card p-4">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<p class="text-muted-foreground text-xs tracking-wider uppercase">Financial Health</p>
				<h3 class="text-lg font-semibold">{healthLabel}</h3>
			</div>
			<div class="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
				This cycle
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
			<div>
				<div class="text-muted-foreground text-xs">Real income</div>
				<div class="font-semibold tabular-nums">
					{hideBalance ? maskedAmount : formatCentsAsCurrency(h.realIncomeCents, data.displayCurrency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground text-xs">Expense</div>
				<div class="font-semibold tabular-nums">
					{hideBalance ? maskedAmount : formatCentsAsCurrency(h.expenseCents, data.displayCurrency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground text-xs">Fixed</div>
				<div class="font-semibold tabular-nums">
					{hideBalance ? maskedAmount : formatCentsAsCurrency(h.fixedExpenseCents, data.displayCurrency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground text-xs">Variable</div>
				<div class="font-semibold tabular-nums">
					{hideBalance ? maskedAmount : formatCentsAsCurrency(h.variableExpenseCents, data.displayCurrency)}
				</div>
			</div>
		</div>

		<div class="mt-3 rounded-lg bg-background/50 p-3 text-sm">
			<div class="flex items-center justify-between gap-3">
				<span class="text-muted-foreground">Real net</span>
				<span class="font-semibold tabular-nums {h.realNetCents < 0 ? 'text-expense' : 'text-income'}">
					{hideBalance ? maskedAmount : formatCentsAsCurrency(h.realNetCents, data.displayCurrency)}
				</span>
			</div>
			{#if h.excludedIncomeCents > 0}
				<div class="text-muted-foreground mt-1 text-xs">
					Excluded non-operating income: {hideBalance ? maskedAmount : formatCentsAsCurrency(h.excludedIncomeCents, data.displayCurrency)}
				</div>
			{/if}
		</div>

		{#if h.topLeaks.length > 0}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each h.topLeaks as leak}
					<span class="bg-background/60 text-muted-foreground rounded-full border px-2.5 py-1 text-xs">
						{leak.categoryName} · {hideBalance ? maskedAmount : formatCentsAsCurrency(leak.amountCents, data.displayCurrency)}
					</span>
				{/each}
			</div>
		{/if}

		<p class="text-muted-foreground mt-3 text-xs leading-relaxed">{healthAdvice}</p>
	</section>
{/if}
```

- [ ] **Step 3: Run UI check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/dashboard/+page.svelte
git commit -m "feat(dashboard): show financial health card"
```

---

### Task 5: Add fixed/variable controls to category forms

**Files:**
- Modify: `src/routes/(app)/categories/+page.server.ts`
- Modify: `src/routes/(app)/categories/+page.svelte`
- Modify: `src/routes/(app)/categories/[id]/+page.server.ts`
- Modify: `src/routes/(app)/categories/[id]/+page.svelte`

- [ ] **Step 1: Inspect category actions and detail edit forms**

Run:

```bash
mgrep "category create update action name kind color icon" "src/routes/(app)/categories"
```

Expected: identify create/edit actions in list page and detail page.

- [ ] **Step 2: Update server actions**

In category create/update actions, parse:

```ts
const expenseType = kind === 'expense' && formData.get('expenseType') === 'fixed' ? 'fixed' : 'variable';
```

Include in inserted/updated values:

```ts
expenseType,
```

For income categories, force `variable` so hidden/stale form values cannot create fixed income categories.

- [ ] **Step 3: Add UI state in list page forms**

In `src/routes/(app)/categories/+page.svelte`, add state near existing create/edit color/icon state:

```ts
let createExpenseType = $state<'fixed' | 'variable'>('variable');
let editExpenseType = $state<'fixed' | 'variable'>('variable');
```

When opening edit, set:

```ts
editExpenseType = c.expenseType === 'fixed' ? 'fixed' : 'variable';
```

In create form enhance, add:

```ts
formData.set('expenseType', createKind === 'expense' ? createExpenseType : 'variable');
```

In edit form enhance, add:

```ts
formData.set('expenseType', editTarget?.kind === 'expense' ? editExpenseType : 'variable');
```

- [ ] **Step 4: Add selector UI for expense categories**

In both create and edit forms, render only when kind is expense:

```svelte
{#if createKind === 'expense'}
	<div class="space-y-2">
		<label class="text-sm font-medium">Expense type</label>
		<SegmentedControl
			options={[
				{ value: 'variable', label: 'Variable' },
				{ value: 'fixed', label: 'Fixed' }
			]}
			bind:value={createExpenseType}
			ariaLabel="Expense type"
		/>
		<p class="text-muted-foreground text-xs">Fixed is for rent, bills, and recurring obligations. Variable is what you can reduce this month.</p>
	</div>
{/if}
```

For edit form, use `editExpenseType` and condition `editTarget?.kind === 'expense'`.

- [ ] **Step 5: Show classification on category rows**

In category row subtitle where kind is shown, add for expense categories:

```svelte
{#if category.kind === 'expense'}
	<span>·</span>
	<span class="capitalize">{category.expenseType}</span>
{/if}
```

- [ ] **Step 6: Update detail page if it edits categories**

Apply the same server action parsing and selector UI in `src/routes/(app)/categories/[id]/+page.server.ts` and `src/routes/(app)/categories/[id]/+page.svelte` if those files expose category edit fields.

- [ ] **Step 7: Run check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/routes/(app)/categories/+page.server.ts" "src/routes/(app)/categories/+page.svelte" "src/routes/(app)/categories/[id]/+page.server.ts" "src/routes/(app)/categories/[id]/+page.svelte"
git commit -m "feat(categories): edit expense type"
```

---

### Task 6: Verify app behavior end-to-end

**Files:**
- No planned code edits. Fix only if verification reveals defects.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run test -- --run
npm run check
```

Expected: both PASS.

- [ ] **Step 2: Apply migration locally/remotely as appropriate**

For local dev DB:

```bash
npm run db:migrate
```

For remote D1 only if user approves remote mutation:

```bash
./node_modules/.bin/wrangler d1 migrations apply mavlo --remote
```

Expected: migration applied once.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev
```

Expected: Vite dev server starts without errors.

- [ ] **Step 4: Manual browser check**

Open dashboard and verify:
- Financial Health card visible.
- Cycle uses `25 Apr <= tx < 25 May` for current configured cycle.
- Real income excludes `Loan Proceeds` and `Balance Adjustment`.
- Fixed and variable totals render.
- Top leaks show variable categories first.
- Hide balance masks all financial health amounts.

Open Categories and verify:
- Expense create/edit shows fixed/variable control.
- Income create/edit does not show fixed/variable control.
- Changing an expense category type persists after refresh.

- [ ] **Step 5: Commit verification fixes only if needed**

If fixes were required:

```bash
git add <changed-files>
git commit -m "fix: polish financial health flow"
```

If no fixes were required, do not commit.

---

## Self-Review

Spec coverage:
- Half-open cycle: Task 2 tests and Task 3 layout normalization.
- Expense classification: Tasks 1 and 5.
- Gross/excluded/real income: Task 2.
- Fixed/variable totals: Task 2 and Task 4.
- Top leaks variable-first: Task 2 and Task 4.
- Status rules: Task 2.
- Advice text: Task 4.
- Manual checks: Task 6.

Placeholder scan: no TBD/TODO placeholders. Task 5 has conditional detail-page work because current code must be inspected before editing exact fields; command and required changes are explicit.

Type consistency:
- DB column: `expense_type`.
- Drizzle property: `expenseType`.
- Form field: `expenseType`.
- Health object: `financialHealth`.
