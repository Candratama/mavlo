# Phase 5 Implementation Plan (Budgets + Settings + R2 Avatar)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Three features:

1. **Budgets** — monthly per-category budget limit + spent tracking with progress bar.
2. **Settings page** — edit user_preferences (currency, locale, timezone, theme, weekStartsOn).
3. **Avatar upload** — image upload to R2, served via worker endpoint, stored on `users.image`.

**Architecture:** Same patterns as Phases 2-4. Budgets schema already exists; just need repo + UI. Settings is a single form-action page editing the existing `user_preferences` row. Avatar upload uses multipart form data, writes to the `UPLOADS` R2 binding, then updates the Better Auth user via `auth.api.updateUser`. R2 stays private — a worker endpoint `/api/avatar/[userId]` streams the image from R2.

**Tech Stack:** Same as Phase 4. R2 binding already wired in `wrangler.jsonc` (Phase 1 T3). `users.image` column exists (Phase 1 auth schema).

**Conventions:**

- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- Branch: `main` (greenfield, branch strategy A)
- Avatar key in R2: `avatars/<userId>/<cuid>.<ext>`
- `users.image` stores the worker URL: `/api/avatar/<userId>` (relative path; SvelteKit handles routing)

---

## Task 1: Budget Validation

**Files:**

- Create: `<NEW_REPO>/src/lib/validation/budget.ts`
- Create: `<NEW_REPO>/src/lib/validation/budget.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { budgetCreateSchema, budgetUpdateSchema } from './budget';

describe('budget validation', () => {
	const valid = { categoryId: 'cat1', periodMonth: '2026-04', limitCents: 500000 };

	it('create requires categoryId, periodMonth (YYYY-MM), positive limitCents', () => {
		expect(budgetCreateSchema.safeParse(valid).success).toBe(true);
		expect(budgetCreateSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, periodMonth: '2026-4' }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, periodMonth: '2026/04' }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, limitCents: 0 }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, limitCents: -100 }).success).toBe(false);
	});

	it('update requires id', () => {
		expect(budgetUpdateSchema.safeParse({ ...valid, id: 'b1' }).success).toBe(true);
		expect(budgetUpdateSchema.safeParse(valid).success).toBe(false);
	});
});
```

- [ ] **Step 2: Run (FAIL)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 3: Create `src/lib/validation/budget.ts`**

```typescript
import { z } from 'zod';

const periodMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const budgetCreateSchema = z.object({
	categoryId: z.string().min(1, 'Category required'),
	periodMonth: z.string().regex(periodMonthRegex, 'Period must be YYYY-MM'),
	limitCents: z.coerce.number().int().positive('Limit must be positive')
});

export const budgetUpdateSchema = budgetCreateSchema.extend({
	id: z.string().min(1, 'Id required')
});

export const budgetIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
```

- [ ] **Step 4: Run (PASS) + type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
npm run check 2>&1 | grep -E "src/lib/validation/budget" || echo "no errors"
git add src/lib/validation/budget.ts src/lib/validation/budget.test.ts
git commit -m "feat(validation): zod schemas for budgets"
```

---

## Task 2: Update Test Fixture for Budgets

**Files:**

- Modify: `<NEW_REPO>/src/lib/server/db/test-fixtures.ts`

Add `budgets` table SQL + extend `tables` opt union.

- [ ] **Step 1: Update `test-fixtures.ts`**

Add new SQL constant:

```typescript
const budgetsTableSql = `
	CREATE TABLE budgets (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
		period_month TEXT NOT NULL,
		limit_cents INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;
```

Update `tables` union + dispatch:

```typescript
export function createTestDb(opts: {
	tables: ('accounts' | 'categories' | 'transactions' | 'budgets')[];
}): TestDbHandle {
	// ... existing ...
	if (opts.tables.includes('budgets')) sqlite.prepare(budgetsTableSql).run();
	// ... existing ...
}
```

- [ ] **Step 2: Run all tests** (no test changes; backward-compat)

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: 52 tests still pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/db/test-fixtures.ts
git commit -m "feat(test): add budgets table to in-memory fixture"
```

---

## Task 3: Budget Repository

**Files:**

- Create: `<NEW_REPO>/src/lib/server/repositories/budgets.ts`
- Create: `<NEW_REPO>/src/lib/server/repositories/budgets.test.ts`

CRUD: list, get, create, update, delete (hard). User-scoped. Filter list by `periodMonth`.

- [ ] **Step 1: Write failing test**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listBudgets, createBudget, updateBudget, deleteBudget, getBudget } from './budgets';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['categories', 'budgets'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('cat1', h.userId, 'Food', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('cat-other', h.otherUserId, 'Other', 'expense', now, now);
});

describe('budgets repository', () => {
	it('createBudget + listBudgets returns own', async () => {
		await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 500000
		});
		await createBudget(h.db, h.otherUserId, {
			categoryId: 'cat-other',
			periodMonth: '2026-04',
			limitCents: 100000
		});

		const list = await listBudgets(h.db, h.userId, { periodMonth: '2026-04' });
		expect(list).toHaveLength(1);
		expect(list[0].limitCents).toBe(500000);
	});

	it('listBudgets filters by periodMonth', async () => {
		await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 100
		});
		await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-05',
			limitCents: 200
		});
		expect(await listBudgets(h.db, h.userId, { periodMonth: '2026-04' })).toHaveLength(1);
		expect(await listBudgets(h.db, h.userId, { periodMonth: '2026-05' })).toHaveLength(1);
	});

	it('updateBudget cross-user returns null', async () => {
		const b = await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 100
		});
		expect(
			await updateBudget(h.db, h.otherUserId, {
				id: b.id,
				categoryId: 'cat1',
				periodMonth: '2026-04',
				limitCents: 999
			})
		).toBeNull();
	});

	it('deleteBudget works for own; cross-user returns null', async () => {
		const b = await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 100
		});
		expect(await deleteBudget(h.db, h.otherUserId, b.id)).toBeNull();
		expect(await deleteBudget(h.db, h.userId, b.id)).not.toBeNull();
		expect(await getBudget(h.db, h.userId, b.id)).toBeNull();
	});
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Create `src/lib/server/repositories/budgets.ts`**

```typescript
import { and, asc, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { budgets } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { BudgetCreateInput, BudgetUpdateInput } from '$lib/validation/budget';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function listBudgets(db: Db, userId: string, filter: { periodMonth?: string }) {
	const conds = [eq(budgets.userId, userId)];
	if (filter.periodMonth) conds.push(eq(budgets.periodMonth, filter.periodMonth));
	return db
		.select()
		.from(budgets)
		.where(and(...conds))
		.orderBy(asc(budgets.categoryId));
}

export async function getBudget(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(budgets)
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
		.limit(1);
	return row ?? null;
}

export async function createBudget(db: Db, userId: string, input: BudgetCreateInput) {
	const [row] = await db
		.insert(budgets)
		.values({
			userId,
			categoryId: input.categoryId,
			periodMonth: input.periodMonth,
			limitCents: input.limitCents
		})
		.returning();
	return row;
}

export async function updateBudget(db: Db, userId: string, input: BudgetUpdateInput) {
	const [row] = await db
		.update(budgets)
		.set({
			categoryId: input.categoryId,
			periodMonth: input.periodMonth,
			limitCents: input.limitCents,
			updatedAt: Date.now()
		})
		.where(and(eq(budgets.userId, userId), eq(budgets.id, input.id)))
		.returning();
	return row ?? null;
}

export async function deleteBudget(db: Db, userId: string, id: string) {
	const [row] = await db
		.delete(budgets)
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
		.returning();
	return row ?? null;
}
```

- [ ] **Step 4: Run (PASS) + type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
npm run check 2>&1 | grep -E "src/lib/server/repositories/budgets" || echo "no errors"
git add src/lib/server/repositories/budgets.ts src/lib/server/repositories/budgets.test.ts
git commit -m "feat(repo): budgets repository with user-scoped queries"
```

---

## Task 4: Budget Spent Computation

**Files:**

- Create: `<NEW_REPO>/src/lib/server/repositories/budget-spent.ts`
- Create: `<NEW_REPO>/src/lib/server/repositories/budget-spent.test.ts`

`computeBudgetSpent(db, userId, periodMonth)` returns `Map<categoryId, spentCents>` for expense transactions in that month. Used to show "spent vs limit" progress on the Budgets page.

- [ ] **Step 1: Test**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { computeBudgetSpent } from './budget-spent';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions', 'budgets'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('cat1', h.userId, 'Food', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('cat2', h.userId, 'Salary', 'income', now, now);
});

const apr2026Start = Date.UTC(2026, 3, 1); // 0-indexed month
const apr2026Mid = Date.UTC(2026, 3, 15);
const may2026 = Date.UTC(2026, 4, 1);

const insertTx = (
	id: string,
	categoryId: string | null,
	kind: 'income' | 'expense',
	amount: number,
	occurredAt: number
) => {
	const cat = categoryId ? `'${categoryId}'` : 'NULL';
	h.sqlite
		.prepare(`INSERT INTO transactions VALUES (?, ?, 'acc1', ${cat}, ?, ?, NULL, ?, ?, ?, NULL)`)
		.run(id, h.userId, amount, kind, occurredAt, occurredAt, occurredAt);
};

describe('computeBudgetSpent', () => {
	it('sums expense by category for the month', () => {
		insertTx('t1', 'cat1', 'expense', 50000, apr2026Mid);
		insertTx('t2', 'cat1', 'expense', 30000, apr2026Mid + 1);
		insertTx('t3', 'cat1', 'income', 100000, apr2026Mid); // ignored — income
		insertTx('t4', 'cat1', 'expense', 99999, may2026); // ignored — wrong month
		insertTx('t5', null, 'expense', 5000, apr2026Mid); // ignored — no category
		// expected for cat1 in 2026-04: 50000 + 30000 = 80000
		return computeBudgetSpent(h.db, h.userId, '2026-04').then((map) => {
			expect(map.get('cat1')).toBe(80000);
		});
	});

	it('cross-user expenses do not count', () => {
		const otherNow = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
			.run('acc-other', h.otherUserId, 'Other', 'cash', 'IDR', 0, otherNow, otherNow);
		h.sqlite
			.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
			.run('cat1-other', h.otherUserId, 'Food', 'expense', otherNow, otherNow);
		h.sqlite
			.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)')
			.run(
				'tx-other',
				h.otherUserId,
				'acc-other',
				'cat1-other',
				123456,
				'expense',
				apr2026Mid,
				apr2026Mid,
				apr2026Mid
			);

		return computeBudgetSpent(h.db, h.userId, '2026-04').then((map) => {
			expect(map.has('cat1-other')).toBe(false);
		});
	});
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Create `src/lib/server/repositories/budget-spent.ts`**

```typescript
import { and, between, eq, isNotNull } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

const periodMonthBounds = (periodMonth: string): { fromMs: number; toMs: number } => {
	const [yStr, mStr] = periodMonth.split('-');
	const y = Number(yStr);
	const m = Number(mStr) - 1;
	return {
		fromMs: Date.UTC(y, m, 1),
		toMs: Date.UTC(y, m + 1, 1) - 1
	};
};

/**
 * Returns Map<categoryId, spentCents>. Sums expense transactions in `periodMonth`
 * (UTC YYYY-MM) for `userId`, grouped by `categoryId`. Transactions without a
 * categoryId are excluded.
 */
export async function computeBudgetSpent(
	db: Db,
	userId: string,
	periodMonth: string
): Promise<Map<string, number>> {
	const { fromMs, toMs } = periodMonthBounds(periodMonth);

	const rows = await db
		.select({
			categoryId: transactions.categoryId,
			amountCents: transactions.amountCents
		})
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				isNotNull(transactions.categoryId),
				between(transactions.occurredAt, fromMs, toMs)
			)
		);

	const map = new Map<string, number>();
	for (const r of rows) {
		if (!r.categoryId) continue;
		map.set(r.categoryId, (map.get(r.categoryId) ?? 0) + r.amountCents);
	}
	return map;
}
```

- [ ] **Step 4: Run (PASS) + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
npm run check 2>&1 | grep -E "src/lib/server/repositories/budget-spent" || echo "no errors"
git add src/lib/server/repositories/budget-spent.ts src/lib/server/repositories/budget-spent.test.ts
git commit -m "feat(repo): budget spent computation per category per month"
```

---

## Task 5: Budgets List Page + Server Actions

**Files:**

- Create: `<NEW_REPO>/src/routes/(app)/budgets/+page.server.ts`
- Create: `<NEW_REPO>/src/routes/(app)/budgets/+page.svelte`

Page shows budgets for selected month (default current). Each row shows category name, limit, spent, progress bar, and row actions (edit/delete). Filter by `?period=YYYY-MM`. Create dialog picks from expense categories.

- [ ] **Step 1: Create `+page.server.ts`**

```typescript
import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	listBudgets,
	createBudget,
	updateBudget,
	deleteBudget
} from '$lib/server/repositories/budgets';
import { listCategories } from '$lib/server/repositories/categories';
import { computeBudgetSpent } from '$lib/server/repositories/budget-spent';
import { budgetCreateSchema, budgetUpdateSchema, budgetIdSchema } from '$lib/validation/budget';
import type { Actions, PageServerLoad } from './$types';

const currentPeriodMonth = (): string => {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const periodMonth = event.url.searchParams.get('period') ?? currentPeriodMonth();
	const [budgets, spent, categories] = await Promise.all([
		listBudgets(db, user.id, { periodMonth }),
		computeBudgetSpent(db, user.id, periodMonth),
		listCategories(db, user.id, { includeArchived: false })
	]);

	const expenseCategories = categories.filter((c) => c.kind === 'expense');
	const spentByCategory = Object.fromEntries(spent.entries());

	return {
		periodMonth,
		budgets,
		expenseCategories,
		categories,
		spentByCategory
	};
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		await createBudget(db, user.id, parsed.data);
		return { success: true, action: 'create' };
	},
	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const updated = await updateBudget(db, user.id, parsed.data);
		if (!updated) return fail(404, { action: 'update', message: 'Budget not found' });
		return { success: true, action: 'update' };
	},
	delete: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'delete', message: 'Invalid id' });
		const deleted = await deleteBudget(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'delete', message: 'Budget not found' });
		return { success: true, action: 'delete' };
	}
};
```

- [ ] **Step 2: Create `+page.svelte`**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-svelte';

	let { data, form } = $props();

	type BudgetRow = (typeof data.budgets)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<BudgetRow | null>(null);

	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const formatCents = (cents: number) =>
		new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(cents / 100);

	const openEdit = (b: BudgetRow) => {
		editTarget = b;
		editOpen = true;
	};

	const pct = (spent: number, limit: number) =>
		limit === 0 ? 0 : Math.min(100, Math.round((spent / limit) * 100));
</script>

<svelte:head><title>Budgets — Mavlo</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold">Budgets</h1>
		<p class="text-muted-foreground mt-1 text-sm">Monthly category spending limits.</p>
	</div>
	<Button onclick={() => (createOpen = true)}>
		<Plus class="mr-1 size-4" /> New budget
	</Button>
</div>

<Card.Root class="mb-6">
	<Card.Content class="p-4">
		<form method="GET" class="flex items-end gap-3">
			<div class="max-w-xs flex-1 space-y-1">
				<Label for="filter-period">Period</Label>
				<Input id="filter-period" type="month" name="period" value={data.periodMonth} />
			</div>
			<Button type="submit">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

{#if form?.message}
	<p class="text-destructive mb-4 text-sm">{form.message}</p>
{/if}

<div class="grid gap-4 md:grid-cols-2">
	{#each data.budgets as budget (budget.id)}
		{@const cat = categoryById.get(budget.categoryId)}
		{@const spent = data.spentByCategory[budget.categoryId] ?? 0}
		{@const percentage = pct(spent, budget.limitCents)}
		{@const over = spent > budget.limitCents}
		<Card.Root>
			<Card.Header class="flex flex-row items-start justify-between">
				<div>
					<Card.Title>{cat?.name ?? 'Unknown'}</Card.Title>
					<Card.Description>{budget.periodMonth}</Card.Description>
				</div>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon" class="size-8">
								<MoreHorizontal class="size-4" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item onclick={() => openEdit(budget)}>
							<Pencil class="mr-2 size-4" /> Edit
						</DropdownMenu.Item>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={budget.id} />
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<button {...props} type="submit" class="text-destructive w-full text-left">
										<Trash2 class="mr-2 size-4" /> Delete
									</button>
								{/snippet}
							</DropdownMenu.Item>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Card.Header>
			<Card.Content>
				<div class="mb-2 flex items-baseline justify-between text-sm tabular-nums">
					<span class={over ? 'font-medium text-rose-600 dark:text-rose-400' : ''}>
						{formatCents(spent)}
					</span>
					<span class="text-muted-foreground">of {formatCents(budget.limitCents)}</span>
				</div>
				<div class="bg-muted h-2 overflow-hidden rounded-full">
					<div
						class={over
							? 'h-full bg-rose-500'
							: percentage >= 80
								? 'h-full bg-amber-500'
								: 'h-full bg-emerald-500'}
						style="width: {percentage}%"
					></div>
				</div>
				<p class="text-muted-foreground mt-2 text-xs">
					{percentage}% used{#if over}
						· over by {formatCents(spent - budget.limitCents)}{/if}
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root class="md:col-span-2">
			<Card.Content class="text-center text-muted-foreground py-12">
				No budgets for {data.periodMonth}.
				<Button variant="link" onclick={() => (createOpen = true)} class="px-1">
					Create the first one
				</Button>.
			</Card.Content>
		</Card.Root>
	{/each}
</div>

<!-- Create dialog -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New budget</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() =>
				async ({ update, result }) => {
					await update();
					if (result.type === 'success') createOpen = false;
				}}
			class="space-y-4"
		>
			<div class="space-y-1">
				<Label for="budget-c-category">Category</Label>
				<select
					id="budget-c-category"
					name="categoryId"
					required
					class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
				>
					{#each data.expenseCategories as c}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="budget-c-period">Period (YYYY-MM)</Label>
					<Input id="budget-c-period" name="periodMonth" required value={data.periodMonth} />
				</div>
				<div class="space-y-1">
					<Label for="budget-c-limit">Limit (cents)</Label>
					<Input id="budget-c-limit" type="number" name="limitCents" min="1" required />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
				<Button type="submit">Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit dialog -->
<Dialog.Root bind:open={editOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit budget</Dialog.Title>
		</Dialog.Header>
		{#if editTarget}
			<form
				method="POST"
				action="?/update"
				use:enhance={() =>
					async ({ update, result }) => {
						await update();
						if (result.type === 'success') editOpen = false;
					}}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editTarget.id} />
				<div class="space-y-1">
					<Label for="budget-e-category">Category</Label>
					<select
						id="budget-e-category"
						name="categoryId"
						required
						class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
					>
						{#each data.expenseCategories as c}
							<option value={c.id} selected={c.id === editTarget.categoryId}>{c.name}</option>
						{/each}
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="budget-e-period">Period (YYYY-MM)</Label>
						<Input
							id="budget-e-period"
							name="periodMonth"
							required
							value={editTarget.periodMonth}
						/>
					</div>
					<div class="space-y-1">
						<Label for="budget-e-limit">Limit (cents)</Label>
						<Input
							id="budget-e-limit"
							type="number"
							name="limitCents"
							min="1"
							required
							value={editTarget.limitCents}
						/>
					</div>
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
					<Button type="submit">Save</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/budgets" || echo "no errors"
git add "src/routes/(app)/budgets/"
git commit -m "feat(budgets): list page with progress bars + CRUD dialogs"
```

---

## Task 6: Settings Page (User Preferences)

**Files:**

- Create: `<NEW_REPO>/src/routes/(app)/settings/+page.server.ts`
- Create: `<NEW_REPO>/src/routes/(app)/settings/+page.svelte`
- Create: `<NEW_REPO>/src/lib/validation/preferences.ts`
- Create: `<NEW_REPO>/src/lib/validation/preferences.test.ts`
- Create: `<NEW_REPO>/src/lib/server/repositories/preferences.ts`
- Create: `<NEW_REPO>/src/lib/server/repositories/preferences.test.ts`

Edit form for `user_preferences` row. Update via form-action; auto-revalidates the layout's load too.

- [ ] **Step 1: Validation TDD**

`src/lib/validation/preferences.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { preferencesUpdateSchema } from './preferences';

describe('preferences validation', () => {
	const valid = {
		currency: 'IDR',
		locale: 'id-ID',
		timezone: 'Asia/Jakarta',
		theme: 'light',
		weekStartsOn: 1
	};

	it('accepts valid input', () => {
		expect(preferencesUpdateSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects invalid theme', () => {
		expect(preferencesUpdateSchema.safeParse({ ...valid, theme: 'magenta' }).success).toBe(false);
	});

	it('rejects weekStartsOn out of range', () => {
		expect(preferencesUpdateSchema.safeParse({ ...valid, weekStartsOn: 7 }).success).toBe(false);
		expect(preferencesUpdateSchema.safeParse({ ...valid, weekStartsOn: -1 }).success).toBe(false);
	});

	it('rejects empty currency or locale', () => {
		expect(preferencesUpdateSchema.safeParse({ ...valid, currency: '' }).success).toBe(false);
		expect(preferencesUpdateSchema.safeParse({ ...valid, locale: '' }).success).toBe(false);
	});
});
```

`src/lib/validation/preferences.ts`:

```typescript
import { z } from 'zod';

export const preferencesUpdateSchema = z.object({
	currency: z.string().trim().min(1, 'Currency required').max(8),
	locale: z.string().trim().min(1, 'Locale required').max(20),
	timezone: z.string().trim().min(1, 'Timezone required').max(60),
	theme: z.enum(['light', 'dark', 'system']),
	weekStartsOn: z.coerce.number().int().min(0).max(6)
});

export type PreferencesUpdateInput = z.infer<typeof preferencesUpdateSchema>;
```

- [ ] **Step 2: Repository TDD**

`src/lib/server/repositories/preferences.test.ts`: skip — preferences upsert is one Drizzle call. Cover via the page's e2e instead.

`src/lib/server/repositories/preferences.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { userPreferences } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { PreferencesUpdateInput } from '$lib/validation/preferences';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function getPreferences(db: Db, userId: string) {
	const [row] = await db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);
	return row ?? null;
}

export async function updatePreferences(db: Db, userId: string, input: PreferencesUpdateInput) {
	const [row] = await db
		.update(userPreferences)
		.set({
			currency: input.currency,
			locale: input.locale,
			timezone: input.timezone,
			theme: input.theme,
			weekStartsOn: input.weekStartsOn,
			updatedAt: Date.now()
		})
		.where(eq(userPreferences.userId, userId))
		.returning();
	return row ?? null;
}
```

(Skip a test file for preferences repo — it's three lines of Drizzle each, covered transitively by the page e2e and the layout-load upsert from Phase 1.)

- [ ] **Step 3: Settings `+page.server.ts`**

```typescript
import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { updatePreferences } from '$lib/server/repositories/preferences';
import { preferencesUpdateSchema } from '$lib/validation/preferences';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Preferences come from (app)/+layout.server.ts via parent data; nothing extra to load here.
	return {};
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = preferencesUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}
		await updatePreferences(db, user.id, parsed.data);
		return { success: true };
	}
};
```

- [ ] **Step 4: Settings `+page.svelte`**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	let { data, form } = $props();
	const prefs = data.preferences;
</script>

<svelte:head><title>Settings — Mavlo</title></svelte:head>

<h1 class="mb-2 text-2xl font-semibold">Settings</h1>
<p class="text-muted-foreground mb-6 text-sm">Customize your Mavlo experience.</p>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Preferences</Card.Title>
		<Card.Description>Currency, locale, timezone, and display options.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" use:enhance class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="pref-currency">Default currency</Label>
					<Input id="pref-currency" name="currency" required maxlength={8} value={prefs.currency} />
				</div>
				<div class="space-y-1">
					<Label for="pref-locale">Locale</Label>
					<Input id="pref-locale" name="locale" required maxlength={20} value={prefs.locale} />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="pref-timezone">Timezone</Label>
					<Input
						id="pref-timezone"
						name="timezone"
						required
						maxlength={60}
						value={prefs.timezone}
					/>
				</div>
				<div class="space-y-1">
					<Label for="pref-theme">Theme</Label>
					<select
						id="pref-theme"
						name="theme"
						required
						class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
					>
						<option value="light" selected={prefs.theme === 'light'}>Light</option>
						<option value="dark" selected={prefs.theme === 'dark'}>Dark</option>
						<option value="system" selected={prefs.theme === 'system'}>System</option>
					</select>
				</div>
			</div>
			<div class="space-y-1">
				<Label for="pref-week">Week starts on (0=Sun, 1=Mon, ..., 6=Sat)</Label>
				<Input
					id="pref-week"
					type="number"
					name="weekStartsOn"
					min="0"
					max="6"
					required
					value={prefs.weekStartsOn}
				/>
			</div>

			{#if form?.success}
				<p class="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
			{:else if form?.message}
				<p class="text-destructive text-sm">{form.message}</p>
			{/if}

			<Button type="submit">Save</Button>
		</form>
	</Card.Content>
</Card.Root>
```

- [ ] **Step 5: Run tests + type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
npm run check 2>&1 | grep -E "src/(routes/\\(app\\)/settings|lib/(validation|server/repositories)/preferences)" || echo "no errors"
git add src/lib/validation/preferences.ts src/lib/validation/preferences.test.ts src/lib/server/repositories/preferences.ts "src/routes/(app)/settings/"
git commit -m "feat(settings): preferences edit page with form action"
```

---

## Task 7: Avatar Upload (R2 + Worker Endpoint)

**Files:**

- Create: `<NEW_REPO>/src/routes/(app)/settings/avatar/+page.server.ts` (the upload action)
- Modify: `<NEW_REPO>/src/routes/(app)/settings/+page.svelte` (add upload form)
- Create: `<NEW_REPO>/src/routes/api/avatar/[userId]/+server.ts` (serve from R2)
- Create: `<NEW_REPO>/src/lib/server/storage/avatar.ts` (R2 helper)
- Create: `<NEW_REPO>/src/lib/server/storage/avatar.test.ts`

Upload writes to `avatars/<userId>/<cuid>.<ext>` in R2. Updates `users.image` to `/api/avatar/<userId>` (relative). The `/api/avatar/[userId]` endpoint reads the latest avatar from R2 and streams it.

Wait — to find "the latest" we need a deterministic key. Easier: store the FULL key in `users.image` and serve via `?key=<key>`. Or: use a deterministic key like `avatars/<userId>/current.<ext>` (one image per user, overwritten on upload). The deterministic key is simpler — going with that.

Schema: `users.image` stores `/api/avatar/<userId>` (the served URL). The R2 key is computed: `avatars/<userId>/current.<ext>`. Extension determined at upload time and stored in `users.image` query string OR baked into the URL. To keep `users.image` stable across re-uploads, store `/api/avatar/<userId>` and have the worker endpoint try common extensions or list-prefix.

Cleanest: deterministic key `avatars/<userId>` (no extension). Content-Type stored as R2 customMetadata. Worker endpoint reads + sets headers from metadata. URL: `/api/avatar/<userId>`.

- [ ] **Step 1: Create `src/lib/server/storage/avatar.ts`**

```typescript
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export interface AvatarUploadArgs {
	bucket: R2Bucket;
	userId: string;
	file: File;
}

export interface AvatarUploadResult {
	contentType: string;
	bytes: number;
}

export async function uploadAvatar(args: AvatarUploadArgs): Promise<AvatarUploadResult> {
	const { bucket, userId, file } = args;

	if (!ALLOWED_TYPES.has(file.type)) {
		throw new Error(`Unsupported image type: ${file.type}`);
	}
	if (file.size > MAX_BYTES) {
		throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB > 2 MB`);
	}

	const key = `avatars/${userId}`;
	const arrayBuffer = await file.arrayBuffer();
	await bucket.put(key, arrayBuffer, {
		httpMetadata: { contentType: file.type },
		customMetadata: { userId }
	});

	return { contentType: file.type, bytes: file.size };
}

export async function getAvatar(args: { bucket: R2Bucket; userId: string }) {
	return args.bucket.get(`avatars/${args.userId}`);
}
```

- [ ] **Step 2: Test for the helper (validation paths only)**

`src/lib/server/storage/avatar.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { uploadAvatar } from './avatar';

const fakeBucket = (): R2Bucket =>
	({
		put: vi.fn().mockResolvedValue({}),
		get: vi.fn().mockResolvedValue(null),
		head: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(undefined),
		list: vi.fn().mockResolvedValue({ objects: [] }),
		createMultipartUpload: vi.fn() as any,
		resumeMultipartUpload: vi.fn() as any
	}) as unknown as R2Bucket;

describe('uploadAvatar', () => {
	it('rejects unsupported types', async () => {
		const bucket = fakeBucket();
		const file = new File(['x'], 'avatar.svg', { type: 'image/svg+xml' });
		await expect(uploadAvatar({ bucket, userId: 'u1', file })).rejects.toThrow(/unsupported/i);
	});

	it('rejects files over 2 MB', async () => {
		const bucket = fakeBucket();
		const big = new Uint8Array(3 * 1024 * 1024);
		const file = new File([big], 'avatar.png', { type: 'image/png' });
		await expect(uploadAvatar({ bucket, userId: 'u1', file })).rejects.toThrow(/too large/i);
	});

	it('puts the file at avatars/<userId>', async () => {
		const bucket = fakeBucket();
		const file = new File([new Uint8Array(100)], 'avatar.png', { type: 'image/png' });
		await uploadAvatar({ bucket, userId: 'u1', file });
		expect(bucket.put).toHaveBeenCalledOnce();
		const [key, , opts] = (bucket.put as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(key).toBe('avatars/u1');
		expect(opts.httpMetadata.contentType).toBe('image/png');
	});
});
```

If the `R2Bucket` type doesn't exist in the test env, mock it as `unknown as R2Bucket`. The `worker-configuration.d.ts` declares it.

- [ ] **Step 3: Create `src/routes/api/avatar/[userId]/+server.ts`**

```typescript
import { error } from '@sveltejs/kit';
import { getAvatar } from '$lib/server/storage/avatar';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const userId = event.params.userId;
	const obj = await getAvatar({ bucket: event.platform!.env.UPLOADS, userId });
	if (!obj) error(404, 'Avatar not found');
	return new Response(obj.body, {
		headers: {
			'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
			'Cache-Control': 'public, max-age=300'
		}
	});
};
```

- [ ] **Step 4: Create `src/routes/(app)/settings/avatar/+page.server.ts`**

```typescript
import { error, fail, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { uploadAvatar } from '$lib/server/storage/avatar';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	throw redirect(302, '/settings');
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const fd = await event.request.formData();
		const file = fd.get('avatar');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'No file uploaded' });
		}
		try {
			await uploadAvatar({ bucket: event.platform!.env.UPLOADS, userId: user.id, file });
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Upload failed' });
		}
		// Update the Better Auth user image to point at our worker endpoint.
		try {
			await event.locals.auth.api.updateUser({
				body: { image: `/api/avatar/${user.id}?v=${Date.now()}` },
				headers: event.request.headers
			});
		} catch {
			error(500, 'Failed to update user profile');
		}
		throw redirect(303, '/settings');
	}
};
```

- [ ] **Step 5: Add upload form to `src/routes/(app)/settings/+page.svelte`**

Append a second Card after the Preferences card:

```svelte
<Card.Root class="mt-6 max-w-2xl">
	<Card.Header>
		<Card.Title>Avatar</Card.Title>
		<Card.Description
			>Upload a profile picture (PNG, JPEG, WebP, or GIF; max 2 MB).</Card.Description
		>
	</Card.Header>
	<Card.Content>
		{#if data.user.image}
			<img
				src={data.user.image}
				alt="Current avatar"
				class="mb-4 size-20 rounded-full border object-cover"
			/>
		{/if}
		<form
			method="POST"
			action="/settings/avatar"
			enctype="multipart/form-data"
			class="flex items-center gap-3"
		>
			<Input
				type="file"
				name="avatar"
				accept="image/png,image/jpeg,image/webp,image/gif"
				required
			/>
			<Button type="submit">Upload</Button>
		</form>
	</Card.Content>
</Card.Root>
```

The `(app)/+layout.server.ts` already returns `data.user` containing `id, name, email`. Need to also return `image` from there. Update T13's layout-load (Phase 1) to include `image`:

In `src/routes/(app)/+layout.server.ts` change the return:

```typescript
return {
	user: { id: user.id, name: user.name, email: user.email, image: user.image },
	preferences: prefs
};
```

- [ ] **Step 6: Type-check + commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
npm run check 2>&1 | grep -E "src/(routes/api/avatar|routes/\\(app\\)/settings|lib/server/storage)" || echo "no errors"
git add src/lib/server/storage/ "src/routes/api/avatar/" "src/routes/(app)/settings/" "src/routes/(app)/+layout.server.ts"
git commit -m "feat(avatar): R2-backed avatar upload with worker serve endpoint"
```

---

## Task 8: Build + Smoke + Deploy

- [ ] **Step 1: Build**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run build 2>&1 | tail -30
```

- [ ] **Step 2: Local preview smoke**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run preview > /tmp/mavlo-preview.log 2>&1 &
PREVIEW_PID=$!
sleep 8

echo "=== /budgets ==="
curl -sI http://localhost:4173/budgets | head -5
echo "=== /settings ==="
curl -sI http://localhost:4173/settings | head -5
echo "=== /api/avatar/nonexistent ==="
curl -sI http://localhost:4173/api/avatar/nonexistent | head -5
echo "=== /api/health ==="
curl -s http://localhost:4173/api/health

kill $PREVIEW_PID 2>/dev/null
sleep 2
```

Expected: budgets + settings 302 → /sign-in; avatar nonexistent 404; health up.

- [ ] **Step 3: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler deploy 2>&1 | tail -30
```

If transient Cloudflare 10500/10001 errors occur, retry up to 2 times. Capture new Version ID.

- [ ] **Step 4: Deployed smoke**

```bash
curl -s https://mavlo.wahyucandratama.workers.dev/api/health
curl -sI https://mavlo.wahyucandratama.workers.dev/budgets | head -5
curl -sI https://mavlo.wahyucandratama.workers.dev/settings | head -5
curl -sI https://mavlo.wahyucandratama.workers.dev/api/avatar/nonexistent | head -5
```

- [ ] **Step 5: Manual e2e (user-run)**
  - /settings: change locale to "en-US", save → message "Saved" appears → reload → locale persists
  - /settings: upload an image (<2 MB) → image preview appears
  - /budgets: change period to current month → "New budget" → pick category, set limit Rp 500.000 → see card with progress bar (0% if no expenses yet, or filled if any)
  - /transactions: add an expense in that category → /budgets: progress bar updates to reflect spending

- [ ] **Step 6: NO commit.**

---

## Phase 5 Done When

- [ ] `/budgets` lists per-category monthly limits with spent/limit progress bar
- [ ] Budget over-limit row shows red; near-limit (≥80%) shows amber
- [ ] `/settings` edits user_preferences via form action; Saved confirmation appears
- [ ] Avatar upload to R2 works; 2 MB / type validation enforced
- [ ] `/api/avatar/[userId]` streams image with correct content-type
- [ ] `users.image` updated to `/api/avatar/<userId>?v=...` after upload
- [ ] Tests pass; build clean; deploy clean

## Out of Scope

- Budget rollover (unspent budget carries to next month)
- Recurring budgets (auto-create per month)
- Avatar cropping / resize before upload
- Multiple avatar versions (keep history)
