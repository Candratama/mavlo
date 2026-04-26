# Phase 6 Implementation Plan (Dashboard Charts via Layerchart)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add three charts to the dashboard:
1. **Spending by category** — donut chart of current-month expenses grouped by category
2. **Daily spending over time** — area chart of daily expense totals for current month
3. **Income vs expense (last 6 months)** — grouped bar chart

**Tech:** `layerchart` (already installed in Phase 1 T1). LayerChart wraps `d3` + `svelte-actions` for declarative charts in Svelte. SSR-safe — renders SVG on server.

**Architecture:** Add server-side aggregation queries (read-only, no schema changes). Pure Svelte components in dashboard page.

**Conventions:**
- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- Branch: `main` (greenfield, branch strategy A)
- All amounts in cents; charts label in IDR via existing `Intl.NumberFormat`

---

## Task 1: Verify Layerchart Install + Basic Sanity

**Files:** none (verify only — `layerchart` was installed in Phase 1 T1)

- [ ] **Step 1: Confirm install**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm ls layerchart
```

If `layerchart` is missing or shows `UNMET DEPENDENCY`, install it:

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm install layerchart
```

If found, proceed.

- [ ] **Step 2: Confirm peer-deps satisfied**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm ls d3
```

`layerchart` depends on `d3` modules (d3-scale, d3-shape, etc.). They should auto-install. Note any peer-dep warnings.

- [ ] **Step 3: Commit if changes**

If npm install ran (i.e., layerchart was missing):

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add package.json package-lock.json
git commit -m "chore(deps): ensure layerchart installed for charts"
```

If layerchart was already installed, skip the commit.

---

## Task 2: Chart Data Aggregations

**Files:**
- Create: `<NEW_REPO>/src/lib/server/repositories/dashboard-stats.ts`
- Create: `<NEW_REPO>/src/lib/server/repositories/dashboard-stats.test.ts`

Three aggregation functions:
- `computeSpendingByCategory(db, userId, periodMonth)` → `Array<{ categoryId, categoryName, amountCents }>` (sorted desc)
- `computeDailySpending(db, userId, periodMonth)` → `Array<{ dateMs, amountCents }>` (one entry per day in month, zeros included)
- `computeMonthlyIncomeExpense(db, userId, monthsBack)` → `Array<{ periodMonth, incomeCents, expenseCents }>` (last N months)

TDD.

- [ ] **Step 1: Write failing tests**

Create `src/lib/server/repositories/dashboard-stats.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	computeSpendingByCategory,
	computeDailySpending,
	computeMonthlyIncomeExpense
} from './dashboard-stats';

let h: TestDbHandle;

const apr2026Day = (day: number) => Date.UTC(2026, 3, day);

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('cat-food', h.userId, 'Food', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('cat-transport', h.userId, 'Transport', 'expense', now, now);
});

const insertTx = (
	id: string,
	categoryId: string | null,
	kind: 'income' | 'expense',
	amount: number,
	occurredAt: number
) => {
	const cat = categoryId ? `'${categoryId}'` : 'NULL';
	h.sqlite
		.prepare(
			`INSERT INTO transactions VALUES (?, ?, 'acc1', ${cat}, ?, ?, NULL, ?, ?, ?, NULL)`
		)
		.run(id, h.userId, amount, kind, occurredAt, occurredAt, occurredAt);
};

describe('computeSpendingByCategory', () => {
	it('groups expenses by category for the month, sorted desc', async () => {
		insertTx('t1', 'cat-food', 'expense', 50000, apr2026Day(5));
		insertTx('t2', 'cat-food', 'expense', 30000, apr2026Day(10));
		insertTx('t3', 'cat-transport', 'expense', 100000, apr2026Day(15));
		insertTx('t4', 'cat-food', 'income', 999, apr2026Day(8)); // ignored
		const rows = await computeSpendingByCategory(h.db, h.userId, '2026-04');
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ categoryId: 'cat-transport', amountCents: 100000 });
		expect(rows[1]).toMatchObject({ categoryId: 'cat-food', amountCents: 80000 });
	});

	it('skips uncategorized expenses', async () => {
		insertTx('t1', null, 'expense', 50000, apr2026Day(5));
		insertTx('t2', 'cat-food', 'expense', 30000, apr2026Day(10));
		const rows = await computeSpendingByCategory(h.db, h.userId, '2026-04');
		expect(rows).toHaveLength(1);
		expect(rows[0].categoryId).toBe('cat-food');
	});
});

describe('computeDailySpending', () => {
	it('returns one entry per day in month with zero-fill', async () => {
		insertTx('t1', 'cat-food', 'expense', 50000, apr2026Day(5));
		insertTx('t2', 'cat-food', 'expense', 30000, apr2026Day(5));
		insertTx('t3', 'cat-food', 'expense', 100000, apr2026Day(15));
		const rows = await computeDailySpending(h.db, h.userId, '2026-04');
		expect(rows).toHaveLength(30); // April has 30 days
		expect(rows[4].amountCents).toBe(80000); // day 5 (index 4)
		expect(rows[5].amountCents).toBe(0); // day 6
		expect(rows[14].amountCents).toBe(100000); // day 15
	});

	it('income rows do not contribute', async () => {
		insertTx('t1', 'cat-food', 'income', 99999, apr2026Day(5));
		const rows = await computeDailySpending(h.db, h.userId, '2026-04');
		expect(rows.every((r) => r.amountCents === 0)).toBe(true);
	});
});

describe('computeMonthlyIncomeExpense', () => {
	it('returns last N months in chronological order', async () => {
		insertTx('t1', 'cat-food', 'expense', 100000, Date.UTC(2026, 1, 15)); // Feb
		insertTx('t2', 'cat-food', 'income', 200000, Date.UTC(2026, 1, 20));
		insertTx('t3', 'cat-food', 'expense', 50000, Date.UTC(2026, 3, 10)); // Apr
		const rows = await computeMonthlyIncomeExpense(h.db, h.userId, 6, '2026-04');
		expect(rows).toHaveLength(6);
		// Ordered oldest-first: Nov 2025, Dec 2025, Jan 2026, Feb 2026, Mar 2026, Apr 2026
		expect(rows[0].periodMonth).toBe('2025-11');
		expect(rows[5].periodMonth).toBe('2026-04');
		const feb = rows.find((r) => r.periodMonth === '2026-02');
		expect(feb).toMatchObject({ incomeCents: 200000, expenseCents: 100000 });
		const apr = rows.find((r) => r.periodMonth === '2026-04');
		expect(apr).toMatchObject({ incomeCents: 0, expenseCents: 50000 });
	});
});
```

- [ ] **Step 2: Run (FAIL)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 3: Create `src/lib/server/repositories/dashboard-stats.ts`**

```typescript
import { and, between, eq, isNotNull } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { categories, transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

const periodMonthBounds = (periodMonth: string) => {
	const [yStr, mStr] = periodMonth.split('-');
	const y = Number(yStr);
	const m = Number(mStr) - 1;
	return {
		fromMs: Date.UTC(y, m, 1),
		toMs: Date.UTC(y, m + 1, 1) - 1,
		daysInMonth: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
		year: y,
		monthIdx: m
	};
};

const formatPeriodMonth = (year: number, monthIdx: number) =>
	`${year}-${String(monthIdx + 1).padStart(2, '0')}`;

export interface SpendingByCategoryRow {
	categoryId: string;
	categoryName: string;
	amountCents: number;
}

export async function computeSpendingByCategory(
	db: Db,
	userId: string,
	periodMonth: string
): Promise<SpendingByCategoryRow[]> {
	const { fromMs, toMs } = periodMonthBounds(periodMonth);

	const txRows = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				isNotNull(transactions.categoryId),
				between(transactions.occurredAt, fromMs, toMs)
			)
		);

	const catRows = await db
		.select()
		.from(categories)
		.where(eq(categories.userId, userId));

	const nameById = new Map(catRows.map((c) => [c.id, c.name]));

	const totals = new Map<string, number>();
	for (const t of txRows) {
		if (!t.categoryId) continue;
		totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountCents);
	}

	const result: SpendingByCategoryRow[] = [];
	for (const [categoryId, amountCents] of totals) {
		result.push({
			categoryId,
			categoryName: nameById.get(categoryId) ?? 'Unknown',
			amountCents
		});
	}
	result.sort((a, b) => b.amountCents - a.amountCents);
	return result;
}

export interface DailySpendingRow {
	dateMs: number;
	amountCents: number;
}

export async function computeDailySpending(
	db: Db,
	userId: string,
	periodMonth: string
): Promise<DailySpendingRow[]> {
	const { fromMs, toMs, daysInMonth, year, monthIdx } = periodMonthBounds(periodMonth);

	const txRows = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				between(transactions.occurredAt, fromMs, toMs)
			)
		);

	// Build zero-filled day buckets
	const buckets: DailySpendingRow[] = [];
	for (let day = 1; day <= daysInMonth; day++) {
		buckets.push({ dateMs: Date.UTC(year, monthIdx, day), amountCents: 0 });
	}

	for (const t of txRows) {
		const d = new Date(t.occurredAt);
		const idx = d.getUTCDate() - 1;
		if (idx >= 0 && idx < buckets.length) {
			buckets[idx].amountCents += t.amountCents;
		}
	}

	return buckets;
}

export interface MonthlyIncomeExpenseRow {
	periodMonth: string;
	incomeCents: number;
	expenseCents: number;
}

export async function computeMonthlyIncomeExpense(
	db: Db,
	userId: string,
	monthsBack: number,
	anchorPeriodMonth: string
): Promise<MonthlyIncomeExpenseRow[]> {
	const { year: anchorY, monthIdx: anchorM } = periodMonthBounds(anchorPeriodMonth);

	// Build the N month windows
	const windows: { periodMonth: string; fromMs: number; toMs: number }[] = [];
	for (let i = monthsBack - 1; i >= 0; i--) {
		const m = anchorM - i;
		const date = new Date(Date.UTC(anchorY, m, 1));
		const y = date.getUTCFullYear();
		const mi = date.getUTCMonth();
		windows.push({
			periodMonth: formatPeriodMonth(y, mi),
			fromMs: Date.UTC(y, mi, 1),
			toMs: Date.UTC(y, mi + 1, 1) - 1
		});
	}

	const earliest = windows[0].fromMs;
	const latest = windows[windows.length - 1].toMs;

	const txRows = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				between(transactions.occurredAt, earliest, latest)
			)
		);

	const result: MonthlyIncomeExpenseRow[] = windows.map((w) => ({
		periodMonth: w.periodMonth,
		incomeCents: 0,
		expenseCents: 0
	}));

	for (const t of txRows) {
		const idx = result.findIndex((r) => {
			const w = windows[result.indexOf(r)];
			return t.occurredAt >= w.fromMs && t.occurredAt <= w.toMs;
		});
		if (idx === -1) continue;
		if (t.kind === 'income') result[idx].incomeCents += t.amountCents;
		else if (t.kind === 'expense') result[idx].expenseCents += t.amountCents;
		// transfers ignored
	}

	return result;
}
```

The `findIndex` lookup in `computeMonthlyIncomeExpense` is O(N²) but N is at most ~12; fine.

- [ ] **Step 4: Run (PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: all 71 tests pass (68 existing + 3 new).

- [ ] **Step 5: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/server/repositories/dashboard-stats" || echo "no errors"
git add src/lib/server/repositories/dashboard-stats.ts src/lib/server/repositories/dashboard-stats.test.ts
git commit -m "feat(repo): dashboard stats — spending by category, daily, monthly income/expense"
```

---

## Task 3: Dashboard Chart Components

**Files:**
- Create: `<NEW_REPO>/src/lib/components/charts/SpendingByCategoryChart.svelte`
- Create: `<NEW_REPO>/src/lib/components/charts/DailySpendingChart.svelte`
- Create: `<NEW_REPO>/src/lib/components/charts/IncomeExpenseChart.svelte`

Three Svelte components wrapping LayerChart primitives. Each takes data via props.

LayerChart's general pattern:
```svelte
<script>
	import { Chart, Pie, Svg, Axis, Bars, Spline, Highlight, Tooltip } from 'layerchart';
</script>

<Chart data={...} x={...} y={...}>
	<Svg>
		<Axis placement="left" />
		<Axis placement="bottom" />
		<Bars ... />
	</Svg>
	<Tooltip>...</Tooltip>
</Chart>
```

The exact API depends on the installed layerchart version. Use `cat node_modules/layerchart/package.json` to confirm version + check `node_modules/layerchart/dist/components/` for available exports if uncertain.

- [ ] **Step 1: Create `src/lib/components/charts/SpendingByCategoryChart.svelte`**

Donut chart. If user has 0 expenses, show "No expense data" message.

```svelte
<script lang="ts">
	import { Chart, Pie, Svg } from 'layerchart';

	interface CategoryRow {
		categoryId: string;
		categoryName: string;
		amountCents: number;
	}

	let { data, currency = 'IDR' }: { data: CategoryRow[]; currency?: string } = $props();

	const formatCents = (cents: number) =>
		new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(
			cents / 100
		);

	const total = $derived(data.reduce((sum, r) => sum + r.amountCents, 0));
</script>

{#if data.length === 0}
	<div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
		No expense data this month.
	</div>
{:else}
	<div class="h-64">
		<Chart {data} y="amountCents" c="categoryName" let:tooltip>
			<Svg>
				<Pie innerRadius={0.6} cornerRadius={2} />
			</Svg>
		</Chart>
	</div>
	<div class="mt-4 space-y-1 text-sm">
		{#each data.slice(0, 5) as row}
			<div class="flex justify-between">
				<span>{row.categoryName}</span>
				<span class="tabular-nums text-muted-foreground">{formatCents(row.amountCents)}</span>
			</div>
		{/each}
		{#if data.length > 5}
			<div class="text-xs text-muted-foreground pt-2">+{data.length - 5} more</div>
		{/if}
		<div class="flex justify-between border-t pt-2 mt-2 font-medium">
			<span>Total</span>
			<span class="tabular-nums">{formatCents(total)}</span>
		</div>
	</div>
{/if}
```

- [ ] **Step 2: Create `src/lib/components/charts/DailySpendingChart.svelte`**

Area chart. X axis = day of month, Y axis = amount.

```svelte
<script lang="ts">
	import { Chart, Svg, Axis, Area, Highlight, Tooltip } from 'layerchart';
	import { scaleTime } from 'd3-scale';

	interface Row {
		dateMs: number;
		amountCents: number;
	}

	let { data, currency = 'IDR' }: { data: Row[]; currency?: string } = $props();

	const total = $derived(data.reduce((sum, r) => sum + r.amountCents, 0));

	const formatCents = (cents: number) =>
		new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(
			cents / 100
		);

	const formatDay = (d: Date) => String(d.getUTCDate());
</script>

{#if total === 0}
	<div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
		No expense data this month.
	</div>
{:else}
	<div class="h-64">
		<Chart
			{data}
			x={(d: Row) => new Date(d.dateMs)}
			xScale={scaleTime()}
			y="amountCents"
			padding={{ top: 8, right: 16, bottom: 24, left: 56 }}
		>
			<Svg>
				<Axis placement="left" rule grid />
				<Axis placement="bottom" format={formatDay} />
				<Area line={{ class: 'stroke-emerald-500 stroke-2' }} class="fill-emerald-500/20" />
				<Highlight points lines />
			</Svg>
			<Tooltip header={(d) => formatDay(new Date(d.dateMs))} let:data>
				<div class="text-sm tabular-nums">{formatCents(data.amountCents)}</div>
			</Tooltip>
		</Chart>
	</div>
{/if}
```

- [ ] **Step 3: Create `src/lib/components/charts/IncomeExpenseChart.svelte`**

Grouped bar chart. X = month (last 6), two bars per group (income green, expense red).

```svelte
<script lang="ts">
	import { Chart, Svg, Axis, Bars, Highlight, Tooltip } from 'layerchart';
	import { scaleBand } from 'd3-scale';

	interface Row {
		periodMonth: string;
		incomeCents: number;
		expenseCents: number;
	}

	let { data, currency = 'IDR' }: { data: Row[]; currency?: string } = $props();

	const formatCents = (cents: number) =>
		new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(
			cents / 100
		);

	const formatMonth = (period: string) => {
		const [y, m] = period.split('-');
		const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
		return date.toLocaleString('en', { month: 'short' });
	};

	// Flatten rows into per-bar entries
	const flat = $derived(
		data.flatMap((r) => [
			{ periodMonth: r.periodMonth, kind: 'income', amountCents: r.incomeCents },
			{ periodMonth: r.periodMonth, kind: 'expense', amountCents: r.expenseCents }
		])
	);

	const hasData = $derived(data.some((r) => r.incomeCents > 0 || r.expenseCents > 0));
</script>

{#if !hasData}
	<div class="flex items-center justify-center h-64 text-sm text-muted-foreground">
		No transaction history yet.
	</div>
{:else}
	<div class="h-64">
		<Chart
			data={flat}
			x="periodMonth"
			xScale={scaleBand().padding(0.2)}
			y="amountCents"
			c="kind"
			cRange={['#10b981', '#f43f5e']}
			cDomain={['income', 'expense']}
			padding={{ top: 8, right: 16, bottom: 24, left: 64 }}
		>
			<Svg>
				<Axis placement="left" rule grid />
				<Axis placement="bottom" format={formatMonth} />
				<Bars groupBy="kind" groupPadding={0.1} radius={2} />
			</Svg>
			<Tooltip header={(d) => formatMonth(d.periodMonth)} let:data>
				<div class="text-sm tabular-nums capitalize">{data.kind}: {formatCents(data.amountCents)}</div>
			</Tooltip>
		</Chart>
	</div>
{/if}
```

If LayerChart's grouped-bars API differs (e.g., `groupBy` not supported), fall back to two `<Bars>` calls or stacked layout. Inspect `node_modules/layerchart/dist/components/Bars*.svelte` to see the prop shape and adapt.

- [ ] **Step 4: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/components/charts" || echo "no errors"
git add src/lib/components/charts/
git commit -m "feat(charts): SpendingByCategory, DailySpending, IncomeExpense components"
```

---

## Task 4: Wire Charts Into Dashboard

**Files:**
- Modify: `<NEW_REPO>/src/routes/(app)/dashboard/+page.server.ts`
- Modify: `<NEW_REPO>/src/routes/(app)/dashboard/+page.svelte`

`+page.server.ts` runs the three new aggregations in parallel. `+page.svelte` adds three Cards each containing one chart component.

- [ ] **Step 1: Update `+page.server.ts`**

Add the three new computations alongside the existing ones. Replace with:

```typescript
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import { listTransactions } from '$lib/server/repositories/transactions';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import {
	computeSpendingByCategory,
	computeDailySpending,
	computeMonthlyIncomeExpense
} from '$lib/server/repositories/dashboard-stats';
import type { PageServerLoad } from './$types';

const currentPeriodMonth = (): string => {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const periodMonth = currentPeriodMonth();
	const now = new Date();
	const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
	const monthEndMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1;

	const [
		balances,
		monthTxns,
		recentTxns,
		accounts,
		categories,
		spendingByCategory,
		dailySpending,
		monthlyIncomeExpense
	] = await Promise.all([
		computeAccountBalances(db, user.id),
		listTransactions(db, user.id, { fromMs: monthStartMs, toMs: monthEndMs }),
		listTransactions(db, user.id, {}),
		listAccounts(db, user.id, { includeArchived: false }),
		listCategories(db, user.id, { includeArchived: false }),
		computeSpendingByCategory(db, user.id, periodMonth),
		computeDailySpending(db, user.id, periodMonth),
		computeMonthlyIncomeExpense(db, user.id, 6, periodMonth)
	]);

	const accountById = new Map(accounts.map((a) => [a.id, a]));
	const categoryById = new Map(categories.map((c) => [c.id, c]));

	const netWorthCents = Array.from(balances.values()).reduce((sum, b) => sum + b, 0);

	const monthExpenseCents = monthTxns
		.filter((t) => t.kind === 'expense')
		.reduce((sum, t) => sum + t.amountCents, 0);
	const monthIncomeCents = monthTxns
		.filter((t) => t.kind === 'income')
		.reduce((sum, t) => sum + t.amountCents, 0);

	const recent = recentTxns.slice(0, 5).map((t) => ({
		id: t.id,
		kind: t.kind,
		amountCents: t.amountCents,
		occurredAt: t.occurredAt,
		note: t.note,
		accountName: accountById.get(t.accountId)?.name ?? null,
		accountCurrency: accountById.get(t.accountId)?.currency ?? 'IDR',
		categoryName: t.categoryId ? (categoryById.get(t.categoryId)?.name ?? null) : null
	}));

	return {
		netWorthCents,
		monthExpenseCents,
		monthIncomeCents,
		recent,
		spendingByCategory,
		dailySpending,
		monthlyIncomeExpense,
		displayCurrency: 'IDR'
	};
};
```

- [ ] **Step 2: Update `+page.svelte`** to add chart Cards.

Insert three new Cards after the existing top-stats grid (after `</div>` that closes the 3-card grid) and before the "Recent transactions" Card. Update imports first:

```svelte
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight } from 'lucide-svelte';
	import SpendingByCategoryChart from '$lib/components/charts/SpendingByCategoryChart.svelte';
	import DailySpendingChart from '$lib/components/charts/DailySpendingChart.svelte';
	import IncomeExpenseChart from '$lib/components/charts/IncomeExpenseChart.svelte';

	let { data } = $props();
	// ... existing helpers ...
</script>
```

Insert charts grid after the existing 3-stat grid:

```svelte
<div class="mt-8 grid gap-4 lg:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>Spending by category</Card.Title>
			<Card.Description>This month</Card.Description>
		</Card.Header>
		<Card.Content>
			<SpendingByCategoryChart data={data.spendingByCategory} currency={data.displayCurrency} />
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Daily spending</Card.Title>
			<Card.Description>This month</Card.Description>
		</Card.Header>
		<Card.Content>
			<DailySpendingChart data={data.dailySpending} currency={data.displayCurrency} />
		</Card.Content>
	</Card.Root>

	<Card.Root class="lg:col-span-2">
		<Card.Header>
			<Card.Title>Income vs expense</Card.Title>
			<Card.Description>Last 6 months</Card.Description>
		</Card.Header>
		<Card.Content>
			<IncomeExpenseChart data={data.monthlyIncomeExpense} currency={data.displayCurrency} />
		</Card.Content>
	</Card.Root>
</div>
```

(Place this entire block between the existing 3-stat grid and the Recent transactions Card.)

- [ ] **Step 3: Type-check**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/dashboard" || echo "no errors"
```

If LayerChart's TypeScript types are strict and fail on something like `let:data` shape, the simplest workaround is to type the prop loosely (`data: any`) inside the chart component's tooltip slot. Don't disable strict mode globally.

- [ ] **Step 4: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add "src/routes/(app)/dashboard/"
git commit -m "feat(dashboard): add spending-by-category, daily-spending, monthly bar charts"
```

---

## Task 5: Build + Smoke + Deploy

- [ ] **Step 1: Build**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run build 2>&1 | tail -30
```

LayerChart is a Svelte library; should build cleanly with the SvelteKit Cloudflare adapter. If it pulls in Node-only deps (`fs`, `path`), the build will surface the error — share it.

- [ ] **Step 2: Local preview smoke**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run preview > /tmp/mavlo-preview.log 2>&1 &
PREVIEW_PID=$!
sleep 8

echo "=== /dashboard ==="
curl -sI http://localhost:4173/dashboard | head -5
echo ""
echo "=== /api/health ==="
curl -s http://localhost:4173/api/health

kill $PREVIEW_PID 2>/dev/null
sleep 2
```

Expected: dashboard 302 → /sign-in (auth gate); health up.

- [ ] **Step 3: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler deploy 2>&1 | tail -30
```

Capture new Version ID. Note the bundle size — charts may bump it noticeably. Workers limit is 1 MB compressed for free tier; check we're under.

- [ ] **Step 4: Deployed smoke**

```bash
curl -s https://mavlo.wahyucandratama.workers.dev/api/health
curl -sI https://mavlo.wahyucandratama.workers.dev/dashboard | head -5
```

- [ ] **Step 5: Manual e2e**

Sign in → /dashboard:
- Three charts visible (some may show empty state if not enough data)
- Spending by category: donut + ranked list with currency
- Daily spending: area chart over the month
- Income vs expense: grouped bars over last 6 months

Hover over chart elements → tooltip with formatted currency.

- [ ] **Step 6: NO commit.**

---

## Phase 6 Done When

- [ ] Three chart components render on `/dashboard` with real data
- [ ] Empty states show when no data
- [ ] Tooltips work on hover
- [ ] Build succeeds (LayerChart bundles cleanly for Workers)
- [ ] Tests pass (3 new aggregation tests)
- [ ] Deployed

## Out of Scope

- Chart customization (color picker, time range selector)
- Export to PNG/PDF
- Per-account spending charts
- Drill-down (click slice → filter transactions)
