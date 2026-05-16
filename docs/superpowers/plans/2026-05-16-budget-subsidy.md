# Budget Subsidy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users cover an overspent budget by transferring slack from another budget in the same month, recorded in a dedicated `budget_subsidies` table, fully editable/deletable, with both original and effective limits visible in the UI.

**Architecture:** New SQLite table `budget_subsidies` with FK cascade to `budgets`. Server-side repository functions enforce validation (target overspent, source has slack, amount cap). UI derives effective limit (`original + in − out`) and renders a dual progress bar plus a subsidy panel. All flows are surfaced through the existing budgets list page and budget detail page; layout-level server load hoists per-period subsidy data once.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Drizzle ORM, Cloudflare D1 (SQLite), Zod, Vitest, Tailwind CSS, shadcn-svelte components.

**Spec:** `docs/superpowers/specs/2026-05-16-budget-subsidy-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `drizzle/0009_add_budget_subsidies.sql` | DB migration: create table + indexes |
| `src/lib/validation/subsidy.ts` | Zod schemas + inferred types |
| `src/lib/validation/subsidy.test.ts` | Validation unit tests |
| `src/lib/server/repositories/subsidies.ts` | CRUD + business-rule enforcement |
| `src/lib/server/repositories/subsidies.test.ts` | Repository unit tests |
| `src/lib/server/repositories/budget-effective.ts` | `computeSubsidyFlows` aggregator |
| `src/lib/server/repositories/budget-effective.test.ts` | Aggregator unit tests |
| `src/lib/utils/budget.ts` | `effectiveLimit` pure helper (shared) |
| `src/lib/utils/budget.test.ts` | Helper unit tests |
| `src/lib/components/budgets/subsidy-create-form.svelte` | Form snippet for creating subsidies |
| `src/lib/components/budgets/subsidy-edit-form.svelte` | Form snippet for editing subsidies |
| `src/lib/components/budgets/subsidy-list.svelte` | Collapsible/inline subsidy list with delete + edit-trigger |

### Modified files

| Path | Change |
|------|--------|
| `src/lib/server/db/schema.ts` | Add `budgetSubsidies` table definition |
| `src/lib/server/db/test-fixtures.ts` | Add `budget_subsidies` table creation + include in tables option type |
| `src/lib/server/demo-seed.ts` | Seed 1–2 sample subsidy rows for demo users |
| `src/routes/(app)/+layout.server.ts` | Load `subsidies` + `subsidyFlowByBudget` for current period |
| `src/routes/(app)/budgets/+page.server.ts` | Add `subsidize`, `updateSubsidy`, `deleteSubsidy` actions |
| `src/routes/(app)/budgets/+page.svelte` | Dual progress bar, "Subsidi" button, subsidy list, summary line |
| `src/routes/(app)/budgets/[id]/+page.svelte` | Effective vs original header, subsidy panel, action triggers |

---

## Task 1: Schema + Migration

**Files:**
- Modify: `src/lib/server/db/schema.ts:97` (after the `budgets` definition, before `userPreferences`)
- Create: `drizzle/0009_add_budget_subsidies.sql`

- [ ] **Step 1: Add `budgetSubsidies` table to schema**

Edit `src/lib/server/db/schema.ts`. Add this block after the closing `)` of the `budgets` table (line 97) and before `export const userPreferences`:

```ts
export const budgetSubsidies = sqliteTable(
	'budget_subsidies',
	{
		id: cuid().primaryKey(),
		userId: userIdFk(),
		periodMonth: text('period_month').notNull(),
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

- [ ] **Step 2: Generate migration**

Run: `npm run db:generate`
Expected: Drizzle creates `drizzle/0009_<random_name>.sql` containing the `CREATE TABLE budget_subsidies` + index statements.

Inspect the file. Rename it to `drizzle/0009_add_budget_subsidies.sql` if the auto-name differs (and update `drizzle/meta/_journal.json` `tag` accordingly).

- [ ] **Step 3: Verify migration content**

Open the generated file. It must include:

```sql
CREATE TABLE `budget_subsidies` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_month` text NOT NULL,
	`from_budget_id` text NOT NULL,
	`to_budget_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subsidies_user_period_idx` ON `budget_subsidies` (`user_id`,`period_month`);
--> statement-breakpoint
CREATE INDEX `subsidies_from_idx` ON `budget_subsidies` (`from_budget_id`);
--> statement-breakpoint
CREATE INDEX `subsidies_to_idx` ON `budget_subsidies` (`to_budget_id`);
```

If anything differs, edit the SQL by hand to match.

- [ ] **Step 4: Run type check**

Run: `npm run check`
Expected: PASS (the schema export resolves; no callers yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/0009_add_budget_subsidies.sql drizzle/meta/
git commit -m "feat(db): add budget_subsidies table"
```

---

## Task 2: Test fixtures support

**Files:**
- Modify: `src/lib/server/db/test-fixtures.ts`

- [ ] **Step 1: Add `budget_subsidies` table SQL constant**

In `src/lib/server/db/test-fixtures.ts`, after the `budgetsTableSql` constant (around line 75), add:

```ts
const budgetSubsidiesTableSql = `
	CREATE TABLE budget_subsidies (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		period_month TEXT NOT NULL,
		from_budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
		to_budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
		amount_cents INTEGER NOT NULL,
		note TEXT,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;
```

- [ ] **Step 2: Extend `tables` option type and creation block**

Update the function signature and creation block in the same file:

```ts
export function createTestDb(opts: {
	tables: ('accounts' | 'categories' | 'transactions' | 'budgets' | 'budget_subsidies')[];
}): TestDbHandle {
	const sqlite = new Database(':memory:');
	const db = drizzle(sqlite, { schema });

	sqlite.prepare(usersTableSql).run();
	if (opts.tables.includes('accounts')) sqlite.prepare(accountsTableSql).run();
	if (opts.tables.includes('categories')) sqlite.prepare(categoriesTableSql).run();
	if (opts.tables.includes('transactions')) sqlite.prepare(transactionsTableSql).run();
	if (opts.tables.includes('budgets')) sqlite.prepare(budgetsTableSql).run();
	if (opts.tables.includes('budget_subsidies'))
		sqlite.prepare(budgetSubsidiesTableSql).run();

	// rest unchanged ...
```

Also enable foreign key enforcement for cascade tests — add this line right after `const db = drizzle(...)`:

```ts
	sqlite.pragma('foreign_keys = ON');
```

- [ ] **Step 3: Run existing tests to confirm no regression**

Run: `npm run test:unit -- --run`
Expected: All existing tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/db/test-fixtures.ts
git commit -m "test: add budget_subsidies table to test fixtures"
```

---

## Task 3: Validation schemas (TDD)

**Files:**
- Create: `src/lib/validation/subsidy.ts`
- Create: `src/lib/validation/subsidy.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/validation/subsidy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	subsidyCreateSchema,
	subsidyUpdateSchema,
	subsidyIdSchema
} from './subsidy';

describe('subsidyCreateSchema', () => {
	const valid = {
		fromBudgetId: 'b1',
		toBudgetId: 'b2',
		amountCents: 1000
	};

	it('accepts valid input', () => {
		expect(subsidyCreateSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts optional note', () => {
		expect(
			subsidyCreateSchema.safeParse({ ...valid, note: 'hello' }).success
		).toBe(true);
	});

	it('rejects fromBudgetId === toBudgetId', () => {
		const result = subsidyCreateSchema.safeParse({
			...valid,
			toBudgetId: valid.fromBudgetId
		});
		expect(result.success).toBe(false);
	});

	it('rejects amountCents <= 0', () => {
		expect(
			subsidyCreateSchema.safeParse({ ...valid, amountCents: 0 }).success
		).toBe(false);
		expect(
			subsidyCreateSchema.safeParse({ ...valid, amountCents: -1 }).success
		).toBe(false);
	});

	it('rejects non-integer amountCents', () => {
		expect(
			subsidyCreateSchema.safeParse({ ...valid, amountCents: 10.5 }).success
		).toBe(false);
	});

	it('rejects note > 200 chars', () => {
		expect(
			subsidyCreateSchema.safeParse({ ...valid, note: 'x'.repeat(201) })
				.success
		).toBe(false);
	});

	it('coerces string amountCents to number', () => {
		const parsed = subsidyCreateSchema.parse({ ...valid, amountCents: '500' });
		expect(parsed.amountCents).toBe(500);
	});
});

describe('subsidyUpdateSchema', () => {
	it('requires id', () => {
		expect(
			subsidyUpdateSchema.safeParse({ amountCents: 100 }).success
		).toBe(false);
	});

	it('accepts id + amountCents', () => {
		expect(
			subsidyUpdateSchema.safeParse({ id: 's1', amountCents: 100 }).success
		).toBe(true);
	});

	it('accepts optional note', () => {
		expect(
			subsidyUpdateSchema.safeParse({ id: 's1', amountCents: 100, note: 'x' })
				.success
		).toBe(true);
	});
});

describe('subsidyIdSchema', () => {
	it('requires non-empty id', () => {
		expect(subsidyIdSchema.safeParse({ id: '' }).success).toBe(false);
		expect(subsidyIdSchema.safeParse({ id: 'x' }).success).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:unit -- --run src/lib/validation/subsidy.test.ts`
Expected: FAIL — `Cannot find module './subsidy'`.

- [ ] **Step 3: Create validation module**

Create `src/lib/validation/subsidy.ts`:

```ts
import { z } from 'zod';

export const subsidyCreateSchema = z
	.object({
		fromBudgetId: z.string().min(1, 'Source budget required'),
		toBudgetId: z.string().min(1, 'Target budget required'),
		amountCents: z.coerce.number().int().positive('Amount must be positive'),
		note: z.string().max(200, 'Note too long').optional()
	})
	.refine((d) => d.fromBudgetId !== d.toBudgetId, {
		message: 'Source and target must differ',
		path: ['toBudgetId']
	});

export const subsidyUpdateSchema = z.object({
	id: z.string().min(1, 'Id required'),
	amountCents: z.coerce.number().int().positive('Amount must be positive'),
	note: z.string().max(200, 'Note too long').optional()
});

export const subsidyIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type SubsidyCreateInput = z.infer<typeof subsidyCreateSchema>;
export type SubsidyUpdateInput = z.infer<typeof subsidyUpdateSchema>;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:unit -- --run src/lib/validation/subsidy.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/subsidy.ts src/lib/validation/subsidy.test.ts
git commit -m "feat(validation): add subsidy schemas"
```

---

## Task 4: `effectiveLimit` helper (TDD)

**Files:**
- Create: `src/lib/utils/budget.ts`
- Create: `src/lib/utils/budget.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/utils/budget.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { effectiveLimit, sourceRemaining } from './budget';

describe('effectiveLimit', () => {
	it('adds inflow', () => {
		expect(effectiveLimit(1000, { in: 200, out: 0 })).toBe(1200);
	});

	it('subtracts outflow', () => {
		expect(effectiveLimit(500, { in: 0, out: 200 })).toBe(300);
	});

	it('handles mixed flow', () => {
		expect(effectiveLimit(500, { in: 100, out: 50 })).toBe(550);
	});

	it('returns original when no flow', () => {
		expect(effectiveLimit(1000, { in: 0, out: 0 })).toBe(1000);
	});
});

describe('sourceRemaining', () => {
	it('returns positive when limit > spent + out', () => {
		expect(
			sourceRemaining({ limitCents: 1000, spentCents: 300, subsidyOutCents: 200 })
		).toBe(500);
	});

	it('returns 0 when fully used', () => {
		expect(
			sourceRemaining({ limitCents: 1000, spentCents: 800, subsidyOutCents: 200 })
		).toBe(0);
	});

	it('returns negative when over-committed', () => {
		expect(
			sourceRemaining({ limitCents: 1000, spentCents: 900, subsidyOutCents: 200 })
		).toBe(-100);
	});
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:unit -- --run src/lib/utils/budget.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create helper**

Create `src/lib/utils/budget.ts`:

```ts
export type SubsidyFlow = { in: number; out: number };

export function effectiveLimit(limitCents: number, flow: SubsidyFlow): number {
	return limitCents + flow.in - flow.out;
}

export function sourceRemaining(input: {
	limitCents: number;
	spentCents: number;
	subsidyOutCents: number;
}): number {
	return input.limitCents - input.spentCents - input.subsidyOutCents;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:unit -- --run src/lib/utils/budget.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/budget.ts src/lib/utils/budget.test.ts
git commit -m "feat(utils): add effectiveLimit and sourceRemaining helpers"
```

---

## Task 5: `computeSubsidyFlows` aggregator (TDD)

**Files:**
- Create: `src/lib/server/repositories/budget-effective.ts`
- Create: `src/lib/server/repositories/budget-effective.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/server/repositories/budget-effective.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { computeSubsidyFlows } from './budget-effective';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({
		tables: ['categories', 'budgets', 'budget_subsidies']
	});
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
		.run('cat1', h.userId, 'Food', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
		.run('cat2', h.userId, 'Transport', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO budgets VALUES (?, ?, ?, ?, ?, ?, ?)')
		.run('b1', h.userId, 'cat1', '2026-04', 1_000_000, now, now);
	h.sqlite
		.prepare('INSERT INTO budgets VALUES (?, ?, ?, ?, ?, ?, ?)')
		.run('b2', h.userId, 'cat2', '2026-04', 500_000, now, now);
});

const insertSubsidy = (
	id: string,
	from: string,
	to: string,
	amount: number,
	period = '2026-04',
	userId?: string
) => {
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO budget_subsidies VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)')
		.run(id, userId ?? h.userId, period, from, to, amount, now, now);
};

describe('computeSubsidyFlows', () => {
	it('returns empty map when no subsidies', async () => {
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.size).toBe(0);
	});

	it('records single transfer as out on source, in on target', async () => {
		insertSubsidy('s1', 'b2', 'b1', 200_000);
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.get('b1')).toEqual({ in: 200_000, out: 0 });
		expect(map.get('b2')).toEqual({ in: 0, out: 200_000 });
	});

	it('accumulates multiple subsidies into same target', async () => {
		insertSubsidy('s1', 'b2', 'b1', 100_000);
		insertSubsidy('s2', 'b2', 'b1', 150_000);
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.get('b1')).toEqual({ in: 250_000, out: 0 });
		expect(map.get('b2')).toEqual({ in: 0, out: 250_000 });
	});

	it('filters by period', async () => {
		insertSubsidy('s1', 'b2', 'b1', 100_000, '2026-04');
		insertSubsidy('s2', 'b2', 'b1', 999_000, '2026-05');
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.get('b1')?.in).toBe(100_000);
	});

	it('filters by user', async () => {
		insertSubsidy('s1', 'b2', 'b1', 100_000, '2026-04', h.otherUserId);
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.size).toBe(0);
	});
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:unit -- --run src/lib/server/repositories/budget-effective.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create aggregator**

Create `src/lib/server/repositories/budget-effective.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { budgetSubsidies } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export type SubsidyFlowMap = Map<string, { in: number; out: number }>;

export async function computeSubsidyFlows(
	db: Db,
	userId: string,
	periodMonth: string
): Promise<SubsidyFlowMap> {
	const rows = await db
		.select()
		.from(budgetSubsidies)
		.where(
			and(
				eq(budgetSubsidies.userId, userId),
				eq(budgetSubsidies.periodMonth, periodMonth)
			)
		);

	const map: SubsidyFlowMap = new Map();
	const bump = (id: string, key: 'in' | 'out', amount: number) => {
		const cur = map.get(id) ?? { in: 0, out: 0 };
		cur[key] += amount;
		map.set(id, cur);
	};
	for (const r of rows) {
		bump(r.fromBudgetId, 'out', r.amountCents);
		bump(r.toBudgetId, 'in', r.amountCents);
	}
	return map;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:unit -- --run src/lib/server/repositories/budget-effective.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/repositories/budget-effective.ts src/lib/server/repositories/budget-effective.test.ts
git commit -m "feat(repo): add computeSubsidyFlows"
```

---

## Task 6: Subsidies repository (TDD)

**Files:**
- Create: `src/lib/server/repositories/subsidies.ts`
- Create: `src/lib/server/repositories/subsidies.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/server/repositories/subsidies.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	createSubsidy,
	deleteSubsidy,
	getSubsidy,
	listSubsidies,
	updateSubsidy
} from './subsidies';

let h: TestDbHandle;
const now = () => Date.now();

const insertCategory = (id: string, userId: string, name = 'X') => {
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
		.run(id, userId, name, 'expense', now(), now());
};

const insertBudget = (
	id: string,
	categoryId: string,
	limit: number,
	period = '2026-04',
	userId?: string
) => {
	h.sqlite
		.prepare('INSERT INTO budgets VALUES (?, ?, ?, ?, ?, ?, ?)')
		.run(id, userId ?? h.userId, categoryId, period, limit, now(), now());
};

const insertAccount = (id: string, userId?: string) => {
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run(id, userId ?? h.userId, 'Acc', 'cash', 'IDR', 0, now(), now());
};

const insertExpense = (
	id: string,
	categoryId: string,
	amount: number,
	occurredAt: number,
	accountId = 'acc1',
	userId?: string
) => {
	h.sqlite
		.prepare(
			`INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, 0)`
		)
		.run(
			id,
			userId ?? h.userId,
			accountId,
			categoryId,
			amount,
			'expense',
			occurredAt,
			occurredAt,
			occurredAt
		);
};

const apr2026Mid = Date.UTC(2026, 3, 15);

beforeEach(() => {
	h = createTestDb({
		tables: ['accounts', 'categories', 'transactions', 'budgets', 'budget_subsidies']
	});
	insertAccount('acc1');
	insertCategory('cat-food', h.userId, 'Food');
	insertCategory('cat-trans', h.userId, 'Transport');
	insertBudget('b-food', 'cat-food', 1_000_000);
	insertBudget('b-trans', 'cat-trans', 500_000);
});

describe('createSubsidy', () => {
	it('rejects when target not overspent', async () => {
		insertExpense('t1', 'cat-food', 500_000, apr2026Mid); // spent < limit
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when source has no remaining', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid); // food overspent 200k
		insertExpense('t2', 'cat-trans', 500_000, apr2026Mid); // trans fully used
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when amount exceeds source remaining', async () => {
		insertExpense('t1', 'cat-food', 1_500_000, apr2026Mid); // food overspent 500k
		insertExpense('t2', 'cat-trans', 300_000, apr2026Mid); // trans has 200k slack
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 300_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when amount exceeds target overage', async () => {
		insertExpense('t1', 'cat-food', 1_100_000, apr2026Mid); // food overspent 100k
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid); // trans has 300k slack
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 200_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when budgets are different periods', async () => {
		insertBudget('b-food-may', 'cat-food', 1_000_000, '2026-05');
		insertExpense('t1', 'cat-food', 1_500_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food-may',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects cross-user budgets', async () => {
		insertCategory('cat-other', h.otherUserId);
		insertBudget('b-other', 'cat-other', 1_000_000, '2026-04', h.otherUserId);
		insertExpense('t1', 'cat-other', 1_500_000, apr2026Mid, 'acc1', h.otherUserId);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-other',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('creates valid subsidy', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 200_000,
			note: 'top up'
		});
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.amountCents).toBe(200_000);
		expect(result.periodMonth).toBe('2026-04');
		expect(result.note).toBe('top up');
	});
});

describe('listSubsidies + getSubsidy', () => {
	beforeEach(async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
	});

	it('lists subsidies for the period', async () => {
		const list = await listSubsidies(h.db, h.userId, { periodMonth: '2026-04' });
		expect(list).toHaveLength(1);
	});

	it('filters cross-user', async () => {
		const list = await listSubsidies(h.db, h.otherUserId, {
			periodMonth: '2026-04'
		});
		expect(list).toHaveLength(0);
	});

	it('getSubsidy returns row for own user', async () => {
		const list = await listSubsidies(h.db, h.userId, { periodMonth: '2026-04' });
		const got = await getSubsidy(h.db, h.userId, list[0].id);
		expect(got?.id).toBe(list[0].id);
	});

	it('getSubsidy returns null cross-user', async () => {
		const list = await listSubsidies(h.db, h.userId, { periodMonth: '2026-04' });
		const got = await getSubsidy(h.db, h.otherUserId, list[0].id);
		expect(got).toBeNull();
	});
});

describe('updateSubsidy', () => {
	beforeEach(() => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
	});

	it('allows reducing amount even when target no longer overspent', async () => {
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 200_000
		});
		if ('error' in created) throw new Error(created.error);
		// User logically reduces. Target overage check is dropped on update.
		const updated = await updateSubsidy(h.db, h.userId, {
			id: created.id,
			amountCents: 50_000
		});
		expect('error' in updated).toBe(false);
		if ('error' in updated) return;
		expect(updated.amountCents).toBe(50_000);
	});

	it('rejects amount exceeding source slack (excluding self)', async () => {
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		// trans has 300k slack (limit 500k, spent 200k). Self uses 100k.
		// New total cap = 100k (self) + 200k slack = 300k. 350k should fail.
		const updated = await updateSubsidy(h.db, h.userId, {
			id: created.id,
			amountCents: 350_000
		});
		expect('error' in updated).toBe(true);
	});

	it('ignores from/to in payload (immutable)', async () => {
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		const updated = await updateSubsidy(h.db, h.userId, {
			id: created.id,
			amountCents: 50_000
		});
		if ('error' in updated) throw new Error(updated.error);
		expect(updated.fromBudgetId).toBe('b-trans');
		expect(updated.toBudgetId).toBe('b-food');
	});

	it('returns error for unknown id', async () => {
		const result = await updateSubsidy(h.db, h.userId, {
			id: 'nope',
			amountCents: 1000
		});
		expect('error' in result).toBe(true);
	});
});

describe('deleteSubsidy', () => {
	it('deletes own subsidy', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		const deleted = await deleteSubsidy(h.db, h.userId, created.id);
		expect(deleted?.id).toBe(created.id);
		expect(await getSubsidy(h.db, h.userId, created.id)).toBeNull();
	});

	it('cross-user delete returns null', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		expect(await deleteSubsidy(h.db, h.otherUserId, created.id)).toBeNull();
	});
});

describe('cascade delete on budget', () => {
	it('removes subsidies when source budget is deleted', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		h.sqlite.prepare('DELETE FROM budgets WHERE id = ?').run('b-trans');
		expect(await getSubsidy(h.db, h.userId, created.id)).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:unit -- --run src/lib/server/repositories/subsidies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create repository module**

Create `src/lib/server/repositories/subsidies.ts`:

```ts
import { and, between, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
	budgets,
	budgetSubsidies,
	transactions
} from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type {
	SubsidyCreateInput,
	SubsidyUpdateInput
} from '$lib/validation/subsidy';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export type SubsidyRow = typeof budgetSubsidies.$inferSelect;
export type RepoError = { error: string };

export async function listSubsidies(
	db: Db,
	userId: string,
	filter: { periodMonth?: string }
): Promise<SubsidyRow[]> {
	const conds = [eq(budgetSubsidies.userId, userId)];
	if (filter.periodMonth)
		conds.push(eq(budgetSubsidies.periodMonth, filter.periodMonth));
	return db
		.select()
		.from(budgetSubsidies)
		.where(and(...conds));
}

export async function getSubsidy(
	db: Db,
	userId: string,
	id: string
): Promise<SubsidyRow | null> {
	const [row] = await db
		.select()
		.from(budgetSubsidies)
		.where(and(eq(budgetSubsidies.userId, userId), eq(budgetSubsidies.id, id)))
		.limit(1);
	return row ?? null;
}

async function getOwnedBudget(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(budgets)
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
		.limit(1);
	return row ?? null;
}

function periodBounds(periodMonth: string): { fromMs: number; toMs: number } {
	const [y, m] = periodMonth.split('-').map(Number);
	const fromMs = Date.UTC(y, m - 1, 1);
	const toMs = Date.UTC(y, m, 1) - 1;
	return { fromMs, toMs };
}

async function spentForCategory(
	db: Db,
	userId: string,
	categoryId: string,
	periodMonth: string
): Promise<number> {
	const { fromMs, toMs } = periodBounds(periodMonth);
	const rows = await db
		.select({ amount: transactions.amountCents })
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				isNotNull(transactions.categoryId),
				eq(transactions.categoryId, categoryId),
				between(transactions.occurredAt, fromMs, toMs)
			)
		);
	return rows.reduce((s, r) => s + r.amount, 0);
}

async function sumSubsidy(
	db: Db,
	userId: string,
	field: 'fromBudgetId' | 'toBudgetId',
	budgetId: string,
	excludeId?: string
): Promise<number> {
	const col =
		field === 'fromBudgetId' ? budgetSubsidies.fromBudgetId : budgetSubsidies.toBudgetId;
	const conds = [eq(budgetSubsidies.userId, userId), eq(col, budgetId)];
	if (excludeId) conds.push(ne(budgetSubsidies.id, excludeId));
	const rows = await db
		.select({ amount: budgetSubsidies.amountCents })
		.from(budgetSubsidies)
		.where(and(...conds));
	return rows.reduce((s, r) => s + r.amount, 0);
}

export async function createSubsidy(
	db: Db,
	userId: string,
	input: SubsidyCreateInput
): Promise<SubsidyRow | RepoError> {
	if (input.fromBudgetId === input.toBudgetId)
		return { error: 'Source and target must differ' };
	if (input.amountCents <= 0)
		return { error: 'Amount must be positive' };

	const [from, to] = await Promise.all([
		getOwnedBudget(db, userId, input.fromBudgetId),
		getOwnedBudget(db, userId, input.toBudgetId)
	]);
	if (!from) return { error: 'Source budget not found' };
	if (!to) return { error: 'Target budget not found' };
	if (from.periodMonth !== to.periodMonth)
		return { error: 'Budgets must be in the same period' };

	const [toSpent, toSubsidyIn, fromSpent, fromSubsidyOut] = await Promise.all([
		spentForCategory(db, userId, to.categoryId, to.periodMonth),
		sumSubsidy(db, userId, 'toBudgetId', to.id),
		spentForCategory(db, userId, from.categoryId, from.periodMonth),
		sumSubsidy(db, userId, 'fromBudgetId', from.id)
	]);

	const targetOverage = toSpent - to.limitCents - toSubsidyIn;
	if (targetOverage <= 0) return { error: 'Target is not overspent' };

	const sourceSlack = from.limitCents - fromSpent - fromSubsidyOut;
	if (sourceSlack <= 0) return { error: 'Source has no remaining allocation' };

	const cap = Math.min(targetOverage, sourceSlack);
	if (input.amountCents > cap)
		return { error: `Amount exceeds cap (${cap})` };

	const [row] = await db
		.insert(budgetSubsidies)
		.values({
			userId,
			periodMonth: from.periodMonth,
			fromBudgetId: from.id,
			toBudgetId: to.id,
			amountCents: input.amountCents,
			note: input.note ?? null
		})
		.returning();
	return row;
}

export async function updateSubsidy(
	db: Db,
	userId: string,
	input: SubsidyUpdateInput
): Promise<SubsidyRow | RepoError> {
	const existing = await getSubsidy(db, userId, input.id);
	if (!existing) return { error: 'Subsidy not found' };

	if (input.amountCents <= 0) return { error: 'Amount must be positive' };

	const from = await getOwnedBudget(db, userId, existing.fromBudgetId);
	if (!from) return { error: 'Source budget not found' };

	const [fromSpent, fromSubsidyOutExcl] = await Promise.all([
		spentForCategory(db, userId, from.categoryId, from.periodMonth),
		sumSubsidy(db, userId, 'fromBudgetId', from.id, existing.id)
	]);

	const sourceSlackExcl = from.limitCents - fromSpent - fromSubsidyOutExcl;
	if (input.amountCents > sourceSlackExcl)
		return { error: `Amount exceeds source remaining (${sourceSlackExcl})` };

	const [row] = await db
		.update(budgetSubsidies)
		.set({
			amountCents: input.amountCents,
			note: input.note ?? null,
			updatedAt: Date.now()
		})
		.where(
			and(eq(budgetSubsidies.userId, userId), eq(budgetSubsidies.id, input.id))
		)
		.returning();
	return row ?? { error: 'Subsidy not found' };
}

export async function deleteSubsidy(
	db: Db,
	userId: string,
	id: string
): Promise<SubsidyRow | null> {
	const [row] = await db
		.delete(budgetSubsidies)
		.where(and(eq(budgetSubsidies.userId, userId), eq(budgetSubsidies.id, id)))
		.returning();
	return row ?? null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:unit -- --run src/lib/server/repositories/subsidies.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm run test:unit -- --run`
Expected: All tests PASS (no regression).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/repositories/subsidies.ts src/lib/server/repositories/subsidies.test.ts
git commit -m "feat(repo): add subsidy CRUD with business-rule validation"
```

---

## Task 7: Layout server load — expose subsidy data

**Files:**
- Modify: `src/routes/(app)/+layout.server.ts`

- [ ] **Step 1: Add load + map**

In `src/routes/(app)/+layout.server.ts`, do these in-place edits:

1. Import `listSubsidies` and `computeSubsidyFlows` alongside existing repo imports (around line 13):

```ts
import { listSubsidies } from '$lib/server/repositories/subsidies';
import { computeSubsidyFlows } from '$lib/server/repositories/budget-effective';
```

2. Extend the `Promise.all` (around line 68) to fetch subsidies + flows in parallel. After the last existing parallel call (`computeMonthlyIncomeExpense`), add two new items:

```ts
		]),
		listSubsidies(db, user.id, { periodMonth: cycle.periodMonth }),
		computeSubsidyFlows(db, user.id, cycle.periodMonth)
	]);
```

Update the destructured array to receive them:

```ts
const [
	accounts,
	allCategories,
	balances,
	periodSummary,
	transactions,
	budgetList,
	budgetSpent,
	spendingByCategory,
	dailySpending,
	monthlyIncomeExpense,
	subsidies,
	subsidyFlows
] = await Promise.all([ ... ]);
```

3. Convert the flow map to a record for the client:

```ts
const subsidyFlowByBudget: Record<string, { in: number; out: number }> =
	Object.fromEntries(subsidyFlows.entries());
```

4. Add both to the returned object (alongside `budgets`, `spentByCategory`, etc.):

```ts
		subsidies,
		subsidyFlowByBudget,
```

- [ ] **Step 2: Run type check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(app\)/+layout.server.ts
git commit -m "feat(load): hoist per-period subsidies into layout data"
```

---

## Task 8: Server actions — subsidize / update / delete

**Files:**
- Modify: `src/routes/(app)/budgets/+page.server.ts`

- [ ] **Step 1: Add imports**

In `src/routes/(app)/budgets/+page.server.ts`, replace the existing imports block at lines 1–8 with:

```ts
import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { createBudget, updateBudget, deleteBudget } from '$lib/server/repositories/budgets';
import {
	createSubsidy,
	updateSubsidy,
	deleteSubsidy
} from '$lib/server/repositories/subsidies';
import { budgetCreateSchema, budgetUpdateSchema, budgetIdSchema } from '$lib/validation/budget';
import {
	subsidyCreateSchema,
	subsidyUpdateSchema,
	subsidyIdSchema
} from '$lib/validation/subsidy';
import { purgeUserCache, allUserCacheNames } from '$lib/server/cf-cache';
import { getCurrentCycle } from '$lib/utils/cycle';
import { getPreferences } from '$lib/server/repositories/preferences';
import type { Actions } from './$types';
```

- [ ] **Step 2: Add three new actions**

Inside the `actions` object, after the existing `delete` action, append:

```ts
	subsidize: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = subsidyCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'subsidize',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const result = await createSubsidy(db, user.id, parsed.data);
		if ('error' in result) {
			return fail(400, { action: 'subsidize', message: result.error });
		}
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'subsidize' };
	},
	updateSubsidy: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = subsidyUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'updateSubsidy',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const result = await updateSubsidy(db, user.id, parsed.data);
		if ('error' in result) {
			return fail(400, { action: 'updateSubsidy', message: result.error });
		}
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'updateSubsidy' };
	},
	deleteSubsidy: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = subsidyIdSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, { action: 'deleteSubsidy', message: 'Invalid id' });
		}
		const deleted = await deleteSubsidy(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'deleteSubsidy', message: 'Subsidy not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'deleteSubsidy' };
	}
```

- [ ] **Step 3: Run type check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/budgets/+page.server.ts
git commit -m "feat(budgets): add subsidize/updateSubsidy/deleteSubsidy actions"
```

---

## Task 9: Budgets list — dual progress bar

**Files:**
- Modify: `src/routes/(app)/budgets/+page.svelte`

- [ ] **Step 1: Import effective-limit helper**

In `src/routes/(app)/budgets/+page.svelte`, add to the imports block (after the `formatCentsAsCurrency` import around line 27):

```ts
	import { effectiveLimit, sourceRemaining } from '$lib/utils/budget.js';
```

- [ ] **Step 2: Derive flow + effective state**

In the `<script>` block, after the existing `categoryById` derived (line 44), add:

```ts
	const flowOf = (budgetId: string) =>
		data.subsidyFlowByBudget[budgetId] ?? { in: 0, out: 0 };

	const effLimitOf = (budget: BudgetRow) =>
		effectiveLimit(budget.limitCents, flowOf(budget.id));
```

- [ ] **Step 3: Replace the in-card progress bar block**

Find the `<Card.Content class="relative z-10">` block (around line 293). Replace its full body (the existing `<div class="mb-2 ...">` through the closing `<p>`) with:

```svelte
				<Card.Content class="relative z-10">
					{@const flow = flowOf(budget.id)}
					{@const effLimit = effectiveLimit(budget.limitCents, flow)}
					{@const stillOver = spent > effLimit}
					{@const coveredByEff = over && !stillOver}
					{@const effPct = effLimit === 0 ? 0 : Math.min(100, Math.round((spent / effLimit) * 100))}
					<div class="mb-2 flex items-baseline justify-between text-sm tabular-nums">
						<span class={stillOver ? 'text-expense font-medium' : ''}>
							{formatCents(spent)}
						</span>
						<span class="text-muted-foreground">
							of {formatCents(budget.limitCents)}
							{#if flow.in > 0 || flow.out > 0}
								<span class="text-xs">(eff {formatCents(effLimit)})</span>
							{/if}
						</span>
					</div>
					<div class="bg-muted relative h-2 overflow-hidden rounded-full">
						{#if stillOver}
							<div class="absolute inset-y-0 left-0 h-full bg-amber-500" style="width: 100%"></div>
							{@const overPct = Math.min(100, Math.round(((spent - effLimit) / Math.max(1, effLimit)) * 100))}
							<div
								class="absolute inset-y-0 right-0 h-full bg-rose-500 transition-all"
								style="width: {overPct}%"
							></div>
						{:else if coveredByEff}
							<div class="h-full bg-emerald-500 transition-all" style="width: 100%"></div>
						{:else}
							<div
								class="h-full transition-all {effPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}"
								style="width: {effPct}%"
							></div>
						{/if}
						{#if flow.in > 0 || flow.out > 0}
							{@const markerPct = effLimit === 0 ? 0 : Math.min(100, Math.round((budget.limitCents / effLimit) * 100))}
							<div
								class="absolute inset-y-0 w-px bg-foreground/40"
								style="left: {markerPct}%"
								aria-hidden="true"
							></div>
						{/if}
					</div>
					<p class="text-muted-foreground mt-2 text-xs">
						{effPct}% used{#if stillOver}
							· over by {formatCents(spent - effLimit)}{:else if coveredByEff}
							· ditutupi subsidi
						{/if}
					</p>
					{#if flow.in > 0}
						<p class="text-muted-foreground mt-1 text-xs">
							↓ disubsidi {formatCents(flow.in)}
						</p>
					{/if}
					{#if flow.out > 0}
						<p class="text-muted-foreground mt-1 text-xs">
							↑ subsidi keluar {formatCents(flow.out)}
						</p>
					{/if}
				</Card.Content>
```

- [ ] **Step 4: Start the dev server and verify visually**

Run: `npm run dev`
Open browser, navigate to `/budgets` while signed in to an account that has at least one overspent budget. Verify:
- Cards still render.
- Overspent cards with no subsidy still show the amber+rose bar.
- No console errors.

(If no overspent fixtures exist, seed one manually via the UI: create a budget with a low limit, add an expense exceeding it.)

- [ ] **Step 5: Commit**

```bash
git add src/routes/\(app\)/budgets/+page.svelte
git commit -m "feat(budgets-ui): dual progress bar with effective limit marker"
```

---

## Task 10: Subsidy create form + "Subsidi" button

**Files:**
- Create: `src/lib/components/budgets/subsidy-create-form.svelte`
- Modify: `src/routes/(app)/budgets/+page.svelte`

- [ ] **Step 1: Create the form component**

Create `src/lib/components/budgets/subsidy-create-form.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import { Tag } from 'lucide-svelte';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';

	type EligibleSource = {
		budgetId: string;
		categoryName: string;
		categoryIcon: string | null;
		sourceRemainingCents: number;
	};

	let {
		targetBudgetId,
		targetCategoryName,
		targetOverageCents,
		alreadyCoveredCents,
		eligibleSources,
		onClose
	}: {
		targetBudgetId: string;
		targetCategoryName: string;
		targetOverageCents: number;
		alreadyCoveredCents: number;
		eligibleSources: EligibleSource[];
		onClose: () => void;
	} = $props();

	let sourceId = $state('');
	let amountCents = $state(0);
	let pending = $state(false);

	const remainingGap = $derived(Math.max(0, targetOverageCents - alreadyCoveredCents));

	const selectedSource = $derived(eligibleSources.find((s) => s.budgetId === sourceId));
	const maxAmount = $derived(
		selectedSource
			? Math.min(remainingGap, selectedSource.sourceRemainingCents)
			: remainingGap
	);

	type Icon = PickerItem['icon'];
	const fallback = Tag as unknown as Icon;
	const sourceItems = $derived<PickerItem[]>(
		eligibleSources.map((s) => ({
			value: s.budgetId,
			label: `${s.categoryName} · sisa ${formatCentsAsCurrency(s.sourceRemainingCents, 'IDR')}`,
			icon: (getIconByName(s.categoryIcon) as unknown as Icon) ?? fallback
		}))
	);
</script>

<form
	method="POST"
	action="/budgets?/subsidize"
	use:enhance={() => {
		pending = true;
		return async ({ result }) => {
			pending = false;
			if (result.type === 'success') {
				await invalidateAll();
				onClose();
				notify.success('Subsidi dicatat');
			} else if (result.type === 'failure') {
				const message = (result.data as { message?: string } | undefined)?.message;
				notify.error(message ?? 'Subsidi gagal');
			}
		};
	}}
	class="space-y-4 p-4"
>
	<input type="hidden" name="toBudgetId" value={targetBudgetId} />
	<div class="rounded-lg bg-muted/40 p-3 text-sm">
		<div class="font-medium">{targetCategoryName}</div>
		<div class="text-muted-foreground mt-1 text-xs">
			Kekurangan: {formatCentsAsCurrency(targetOverageCents, 'IDR')}
		</div>
		<div class="text-muted-foreground text-xs">
			Sudah disubsidi: {formatCentsAsCurrency(alreadyCoveredCents, 'IDR')}
		</div>
		<div class="text-xs font-medium">
			Sisa yang bisa ditutup: {formatCentsAsCurrency(remainingGap, 'IDR')}
		</div>
	</div>

	<div class="space-y-1">
		<Label>Sumber</Label>
		{#if sourceItems.length === 0}
			<p class="text-muted-foreground text-sm">
				Tidak ada budget dengan sisa alokasi.
			</p>
		{:else}
			<PickerSheet
				items={sourceItems}
				bind:value={sourceId}
				name="fromBudgetId"
				placeholder="Pilih sumber"
				title="Sumber"
				searchable
			/>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="subsidy-amount">Jumlah</Label>
		<MoneyInput
			id="subsidy-amount"
			name="amountCents"
			min={1}
			max={maxAmount > 0 ? maxAmount : undefined}
			bind:value={amountCents}
			required
			class="h-12 text-lg md:h-12 md:text-lg"
		/>
		{#if selectedSource}
			<p class="text-muted-foreground text-xs">
				Maks: {formatCentsAsCurrency(maxAmount, 'IDR')}
			</p>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="subsidy-note">Catatan (opsional)</Label>
		<Input id="subsidy-note" name="note" maxlength="200" />
	</div>

	<div class="flex gap-2 pt-2">
		<Button
			type="button"
			variant="outline"
			onclick={onClose}
			class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
		>
			Cancel
		</Button>
		<SubmitButton
			pending={pending}
			disabled={!sourceId || amountCents <= 0 || amountCents > maxAmount}
			class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
		>
			Subsidi
		</SubmitButton>
	</div>
</form>
```

- [ ] **Step 2: Add subsidy state + helpers to the list page**

In `src/routes/(app)/budgets/+page.svelte` `<script>` block, after the existing `editCategoryId` state (around line 87) add:

```ts
	import SubsidyCreateForm from '$lib/components/budgets/subsidy-create-form.svelte';

	let subsidyOpen = $state(false);
	let subsidyTarget = $state<BudgetRow | null>(null);

	const eligibleSourcesFor = (target: BudgetRow) => {
		return data.budgets
			.filter((b) => b.id !== target.id && b.periodMonth === target.periodMonth)
			.map((b) => {
				const spentB = data.spentByCategory[b.categoryId] ?? 0;
				const out = (data.subsidyFlowByBudget[b.id]?.out) ?? 0;
				const remaining = sourceRemaining({
					limitCents: b.limitCents,
					spentCents: spentB,
					subsidyOutCents: out
				});
				const cat = categoryById.get(b.categoryId);
				return {
					budgetId: b.id,
					categoryName: cat?.name ?? 'Unknown',
					categoryIcon: cat?.icon ?? null,
					sourceRemainingCents: remaining
				};
			})
			.filter((s) => s.sourceRemainingCents > 0);
	};

	const openSubsidy = (b: BudgetRow) => {
		subsidyTarget = b;
		subsidyOpen = true;
	};
```

(The import line goes near the top of the script — group with other component imports.)

- [ ] **Step 3: Render the "Subsidi" button on cards where appropriate**

Inside the `<Card.Content>` block (the one edited in Task 9), after the closing of the existing label section but still inside `<Card.Content>`, append:

```svelte
					{#if stillOver}
						{@const sources = eligibleSourcesFor(budget)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="mt-3 w-full"
							disabled={sources.length === 0}
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								openSubsidy(budget);
							}}
						>
							Subsidi dari budget lain
						</Button>
					{/if}
```

- [ ] **Step 4: Render the dialog/sheet at the bottom**

After the existing Edit dialog/sheet block (around line 522), append:

```svelte
{#snippet subsidyForm()}
	{#if subsidyTarget}
		{@const flow = flowOf(subsidyTarget.id)}
		{@const spent = data.spentByCategory[subsidyTarget.categoryId] ?? 0}
		{@const overage = spent - subsidyTarget.limitCents}
		{@const cat = categoryById.get(subsidyTarget.categoryId)}
		<SubsidyCreateForm
			targetBudgetId={subsidyTarget.id}
			targetCategoryName={cat?.name ?? 'Unknown'}
			targetOverageCents={Math.max(0, overage)}
			alreadyCoveredCents={flow.in}
			eligibleSources={eligibleSourcesFor(subsidyTarget)}
			onClose={() => (subsidyOpen = false)}
		/>
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={subsidyOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Subsidi budget</Dialog.Title></Dialog.Header>
			{@render subsidyForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={subsidyOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Subsidi budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render subsidyForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
```

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`
Steps:
1. Sign in to a user with at least one overspent budget and another budget with slack.
2. Click "Subsidi dari budget lain" on the overspent card.
3. Pick a source, enter an amount within the cap, submit.
4. After invalidateAll, the bar should now reflect the subsidy and the card should turn "covered" state.
5. Try submitting an amount over the cap — server should reject with toast error.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/budgets/subsidy-create-form.svelte src/routes/\(app\)/budgets/+page.svelte
git commit -m "feat(budgets-ui): add subsidy create flow"
```

---

## Task 11: Subsidy list (inline edit + delete)

**Files:**
- Create: `src/lib/components/budgets/subsidy-edit-form.svelte`
- Create: `src/lib/components/budgets/subsidy-list.svelte`
- Modify: `src/routes/(app)/budgets/+page.svelte`

- [ ] **Step 1: Create the edit form**

Create `src/lib/components/budgets/subsidy-edit-form.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';

	let {
		subsidyId,
		fromName,
		toName,
		currentAmountCents,
		sourceRemainingExclSelfCents,
		currentNote,
		onClose
	}: {
		subsidyId: string;
		fromName: string;
		toName: string;
		currentAmountCents: number;
		sourceRemainingExclSelfCents: number;
		currentNote: string | null;
		onClose: () => void;
	} = $props();

	let amountCents = $state(currentAmountCents);
	let pending = $state(false);

	const maxAmount = $derived(sourceRemainingExclSelfCents);
</script>

<form
	method="POST"
	action="/budgets?/updateSubsidy"
	use:enhance={() => {
		pending = true;
		return async ({ result }) => {
			pending = false;
			if (result.type === 'success') {
				await invalidateAll();
				onClose();
				notify.success('Subsidi diperbarui');
			} else if (result.type === 'failure') {
				const message = (result.data as { message?: string } | undefined)?.message;
				notify.error(message ?? 'Update gagal');
			}
		};
	}}
	class="space-y-4 p-4"
>
	<input type="hidden" name="id" value={subsidyId} />
	<div class="rounded-lg bg-muted/40 p-3 text-sm">
		<div class="font-medium">{fromName} → {toName}</div>
		<div class="text-muted-foreground mt-1 text-xs">
			From/to tidak bisa diubah.
		</div>
	</div>

	<div class="space-y-1">
		<Label for="subsidy-edit-amount">Jumlah</Label>
		<MoneyInput
			id="subsidy-edit-amount"
			name="amountCents"
			min={1}
			max={maxAmount}
			bind:value={amountCents}
			required
			class="h-12 text-lg md:h-12 md:text-lg"
		/>
		<p class="text-muted-foreground text-xs">
			Maks: {formatCentsAsCurrency(maxAmount, 'IDR')}
		</p>
	</div>

	<div class="space-y-1">
		<Label for="subsidy-edit-note">Catatan</Label>
		<Input id="subsidy-edit-note" name="note" maxlength="200" value={currentNote ?? ''} />
	</div>

	<div class="flex gap-2 pt-2">
		<Button
			type="button"
			variant="outline"
			onclick={onClose}
			class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
		>
			Cancel
		</Button>
		<SubmitButton
			pending={pending}
			disabled={amountCents <= 0 || amountCents > maxAmount}
			class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
		>
			Simpan
		</SubmitButton>
	</div>
</form>
```

- [ ] **Step 2: Create the list component**

Create `src/lib/components/budgets/subsidy-list.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';

	type SubsidyEntry = {
		id: string;
		direction: 'in' | 'out';
		counterpartName: string;
		amountCents: number;
		note: string | null;
	};

	let {
		entries,
		onEdit
	}: {
		entries: SubsidyEntry[];
		onEdit: (id: string) => void;
	} = $props();

	let open = $state(false);
</script>

{#if entries.length > 0}
	<div class="relative z-10 mt-3 border-t pt-3 text-xs">
		<button
			type="button"
			class="text-muted-foreground hover:text-foreground flex w-full items-center justify-between"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				open = !open;
			}}
		>
			<span>{entries.length} subsidi aktif</span>
			{#if open}<ChevronUp class="size-3" />{:else}<ChevronDown class="size-3" />{/if}
		</button>
		{#if open}
			<ul class="mt-2 space-y-1">
				{#each entries as e (e.id)}
					<li class="flex items-center justify-between gap-2">
						<span class="truncate">
							{e.direction === 'in' ? '↓' : '↑'} {formatCentsAsCurrency(e.amountCents, 'IDR')}
							{e.direction === 'in' ? 'dari' : 'ke'} {e.counterpartName}
						</span>
						<span class="flex shrink-0 items-center gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="size-7"
								onclick={(ev) => {
									ev.preventDefault();
									ev.stopPropagation();
									onEdit(e.id);
								}}
							>
								<Pencil class="size-3" />
							</Button>
							<form
								method="POST"
								action="/budgets?/deleteSubsidy"
								use:enhance={() =>
									async ({ result }) => {
										if (result.type === 'success') {
											await invalidateAll();
											notify.success('Subsidi dihapus');
										} else if (result.type === 'failure') {
											const message = (result.data as { message?: string } | undefined)?.message;
											notify.error(message ?? 'Hapus gagal');
										}
									}}
								onclick={(ev) => ev.stopPropagation()}
							>
								<input type="hidden" name="id" value={e.id} />
								<Button type="submit" variant="ghost" size="icon" class="size-7 text-destructive">
									<Trash2 class="size-3" />
								</Button>
							</form>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
```

- [ ] **Step 3: Wire the list + edit dialog into the page**

In `src/routes/(app)/budgets/+page.svelte` `<script>`, add the import and new state:

```ts
	import SubsidyList from '$lib/components/budgets/subsidy-list.svelte';
	import SubsidyEditForm from '$lib/components/budgets/subsidy-edit-form.svelte';

	type SubsidyRow = (typeof data.subsidies)[number];

	let subsidyEditOpen = $state(false);
	let subsidyEditTarget = $state<SubsidyRow | null>(null);

	const budgetById = $derived(new Map(data.budgets.map((b) => [b.id, b])));

	const subsidiesByBudget = $derived(() => {
		const inMap = new Map<string, SubsidyRow[]>();
		const outMap = new Map<string, SubsidyRow[]>();
		for (const s of data.subsidies) {
			const inArr = inMap.get(s.toBudgetId) ?? [];
			inArr.push(s);
			inMap.set(s.toBudgetId, inArr);
			const outArr = outMap.get(s.fromBudgetId) ?? [];
			outArr.push(s);
			outMap.set(s.fromBudgetId, outArr);
		}
		return { inMap, outMap };
	});

	const entriesForBudget = (budgetId: string) => {
		const { inMap, outMap } = subsidiesByBudget();
		const entries: {
			id: string;
			direction: 'in' | 'out';
			counterpartName: string;
			amountCents: number;
			note: string | null;
		}[] = [];
		for (const s of inMap.get(budgetId) ?? []) {
			const fromBudget = budgetById.get(s.fromBudgetId);
			const cat = fromBudget ? categoryById.get(fromBudget.categoryId) : null;
			entries.push({
				id: s.id,
				direction: 'in',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		for (const s of outMap.get(budgetId) ?? []) {
			const toBudget = budgetById.get(s.toBudgetId);
			const cat = toBudget ? categoryById.get(toBudget.categoryId) : null;
			entries.push({
				id: s.id,
				direction: 'out',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		return entries;
	};

	const openSubsidyEdit = (subsidyId: string) => {
		subsidyEditTarget = data.subsidies.find((s) => s.id === subsidyId) ?? null;
		subsidyEditOpen = subsidyEditTarget !== null;
	};
```

- [ ] **Step 4: Render the list inside each card**

Inside `<Card.Content>` (after the "Subsidi" button block from Task 10), add:

```svelte
					<SubsidyList
						entries={entriesForBudget(budget.id)}
						onEdit={openSubsidyEdit}
					/>
```

- [ ] **Step 5: Add the edit dialog/sheet**

After the subsidy create dialog/sheet block, append:

```svelte
{#snippet subsidyEditFormSnippet()}
	{#if subsidyEditTarget}
		{@const fromBudget = budgetById.get(subsidyEditTarget.fromBudgetId)}
		{@const toBudget = budgetById.get(subsidyEditTarget.toBudgetId)}
		{@const fromCat = fromBudget ? categoryById.get(fromBudget.categoryId) : null}
		{@const toCat = toBudget ? categoryById.get(toBudget.categoryId) : null}
		{@const fromSpent = fromBudget ? (data.spentByCategory[fromBudget.categoryId] ?? 0) : 0}
		{@const fromFlowOut = fromBudget ? (data.subsidyFlowByBudget[fromBudget.id]?.out ?? 0) : 0}
		{@const remainingExclSelf =
			(fromBudget?.limitCents ?? 0) - fromSpent - fromFlowOut + subsidyEditTarget.amountCents}
		<SubsidyEditForm
			subsidyId={subsidyEditTarget.id}
			fromName={fromCat?.name ?? 'Unknown'}
			toName={toCat?.name ?? 'Unknown'}
			currentAmountCents={subsidyEditTarget.amountCents}
			sourceRemainingExclSelfCents={remainingExclSelf}
			currentNote={subsidyEditTarget.note}
			onClose={() => (subsidyEditOpen = false)}
		/>
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={subsidyEditOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit subsidi</Dialog.Title></Dialog.Header>
			{@render subsidyEditFormSnippet()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={subsidyEditOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Edit subsidi</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render subsidyEditFormSnippet()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
```

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`
Steps:
1. Open a budget card that has a subsidy.
2. Expand the "N subsidi aktif" panel.
3. Click the pencil; edit amount; submit; confirm toast + updated bar.
4. Click the trash icon; confirm subsidy is removed and bar reverts.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/budgets/subsidy-edit-form.svelte src/lib/components/budgets/subsidy-list.svelte src/routes/\(app\)/budgets/+page.svelte
git commit -m "feat(budgets-ui): list, edit, delete subsidies inline"
```

---

## Task 12: Summary line for subsidies

**Files:**
- Modify: `src/routes/(app)/budgets/+page.svelte`

- [ ] **Step 1: Add summary line under "Spent vs Budget" card**

Find the "Spent vs Budget" card block (around line 161). Inside it, after the `<div class="text-muted-foreground flex justify-between text-xs tabular-nums">` row, append:

```svelte
		{#if data.subsidies.length > 0}
			{@const totalSubsidy = data.subsidies.reduce((s, x) => s + x.amountCents, 0)}
			<div class="text-muted-foreground mt-2 text-xs">
				Subsidi aktif: {data.subsidies.length} record, total {formatCents(totalSubsidy)} dipindahkan.
			</div>
		{/if}
```

- [ ] **Step 2: Type check + visual verify**

Run: `npm run check`
Expected: PASS.

Run the dev server, navigate to `/budgets`, confirm the line appears only when at least one subsidy exists in the active period.

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(app\)/budgets/+page.svelte
git commit -m "feat(budgets-ui): show subsidy summary line"
```

---

## Task 13: Budget detail page — subsidy panel

**Files:**
- Modify: `src/routes/(app)/budgets/[id]/+page.svelte`

- [ ] **Step 1: Import helpers + components**

In `src/routes/(app)/budgets/[id]/+page.svelte` `<script>` block, add to the import section:

```ts
	import { effectiveLimit, sourceRemaining } from '$lib/utils/budget.js';
	import SubsidyList from '$lib/components/budgets/subsidy-list.svelte';
	import SubsidyCreateForm from '$lib/components/budgets/subsidy-create-form.svelte';
	import SubsidyEditForm from '$lib/components/budgets/subsidy-edit-form.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import { MediaQuery } from 'svelte/reactivity';
```

- [ ] **Step 2: Derive effective state + subsidy entries**

After the existing `over` / `remainingCents` derived lines (around line 62), add:

```ts
	const isDesktop = new MediaQuery('(min-width: 768px)');

	type SubsidyRow = (typeof data.subsidies)[number];

	const budgetById = $derived(new Map(data.budgets.map((b) => [b.id, b])));
	const allCategoriesById = $derived(
		new Map(data.allCategories.map((c) => [c.id, c]))
	);

	const flow = $derived(
		budget ? (data.subsidyFlowByBudget[budget.id] ?? { in: 0, out: 0 }) : { in: 0, out: 0 }
	);
	const effLimit = $derived(budget ? effectiveLimit(budget.limitCents, flow) : 0);
	const effPct = $derived(
		effLimit > 0 ? Math.min(100, Math.round((spentCents / effLimit) * 100)) : 0
	);
	const stillOver = $derived(spentCents > effLimit);
	const coveredByEff = $derived(over && !stillOver);

	const subsidiesIn = $derived(
		budget ? data.subsidies.filter((s) => s.toBudgetId === budget.id) : []
	);
	const subsidiesOut = $derived(
		budget ? data.subsidies.filter((s) => s.fromBudgetId === budget.id) : []
	);

	const eligibleSources = $derived.by(() => {
		if (!budget) return [];
		return data.budgets
			.filter((b) => b.id !== budget.id && b.periodMonth === budget.periodMonth)
			.map((b) => {
				const spentB = data.spentByCategory[b.categoryId] ?? 0;
				const out = data.subsidyFlowByBudget[b.id]?.out ?? 0;
				const remaining = sourceRemaining({
					limitCents: b.limitCents,
					spentCents: spentB,
					subsidyOutCents: out
				});
				const cat = allCategoriesById.get(b.categoryId);
				return {
					budgetId: b.id,
					categoryName: cat?.name ?? 'Unknown',
					categoryIcon: cat?.icon ?? null,
					sourceRemainingCents: remaining
				};
			})
			.filter((s) => s.sourceRemainingCents > 0);
	});

	let subsidyOpen = $state(false);
	let subsidyEditOpen = $state(false);
	let subsidyEditTarget = $state<SubsidyRow | null>(null);

	const openSubsidyEdit = (id: string) => {
		subsidyEditTarget = data.subsidies.find((s) => s.id === id) ?? null;
		subsidyEditOpen = subsidyEditTarget !== null;
	};

	const entries = $derived.by(() => {
		const list: {
			id: string;
			direction: 'in' | 'out';
			counterpartName: string;
			amountCents: number;
			note: string | null;
		}[] = [];
		for (const s of subsidiesIn) {
			const fromB = budgetById.get(s.fromBudgetId);
			const cat = fromB ? allCategoriesById.get(fromB.categoryId) : null;
			list.push({
				id: s.id,
				direction: 'in',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		for (const s of subsidiesOut) {
			const toB = budgetById.get(s.toBudgetId);
			const cat = toB ? allCategoriesById.get(toB.categoryId) : null;
			list.push({
				id: s.id,
				direction: 'out',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		return list;
	});
```

- [ ] **Step 3: Update the existing progress card to show effective**

Replace the "Budget progress" block (around lines 169–215) with:

```svelte
	<div
		class="mb-6 rounded-xl border bg-gradient-to-br {stillOver ? 'from-rose-500/10' : coveredByEff ? 'from-emerald-500/10' : effPct >= 80 ? 'from-amber-500/10' : 'from-emerald-500/10'} via-card to-card p-4"
	>
		<div class="mb-3 flex items-baseline justify-between">
			<span class="text-sm font-semibold">Spent this cycle</span>
			<span class="text-sm font-semibold tabular-nums {stillOver ? 'text-expense' : ''}">
				{effPct}%
			</span>
		</div>
		<div class="bg-muted relative mb-3 h-2.5 overflow-hidden rounded-full">
			{#if stillOver}
				<div class="absolute inset-y-0 left-0 h-full rounded-full bg-amber-500" style="width: 100%"></div>
				{@const overPct = Math.min(100, Math.round(((spentCents - effLimit) / Math.max(1, effLimit)) * 100))}
				<div class="absolute inset-y-0 right-0 h-full rounded-full bg-rose-500 transition-all" style="width: {overPct}%"></div>
			{:else if coveredByEff}
				<div class="h-full rounded-full bg-emerald-500 transition-all" style="width: 100%"></div>
			{:else}
				<div
					class="h-full rounded-full transition-all {effPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}"
					style="width: {effPct}%"
				></div>
			{/if}
		</div>
		<div class="grid grid-cols-3 gap-3 text-xs">
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">Spent</div>
				<div class="mt-1 font-semibold tabular-nums {stillOver ? 'text-expense' : ''}">
					{formatCentsAsCurrency(spentCents, currency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">Limit</div>
				<div class="mt-1 font-semibold tabular-nums">
					{formatCentsAsCurrency(limitCents, currency)}
				</div>
				{#if flow.in > 0 || flow.out > 0}
					<div class="text-muted-foreground text-[10px]">
						eff {formatCentsAsCurrency(effLimit, currency)}
					</div>
				{/if}
			</div>
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">{stillOver ? 'Over by' : 'Left'}</div>
				<div class="mt-1 font-semibold tabular-nums {stillOver ? 'text-expense' : 'text-income'}">
					{#if stillOver}
						−{formatCentsAsCurrency(spentCents - effLimit, currency)}
					{:else}
						{formatCentsAsCurrency(Math.max(0, effLimit - spentCents), currency)}
					{/if}
				</div>
			</div>
		</div>
	</div>
```

- [ ] **Step 4: Add subsidy panel between progress and transactions list**

After the closing `{/if}` of the "Budget progress" block (so right before `<div class="space-y-5">` that renders transactions), add:

```svelte
{#if budget}
	<div class="mb-6 rounded-xl border bg-card p-4">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">Subsidi</h2>
			{#if stillOver}
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={eligibleSources.length === 0}
					onclick={() => (subsidyOpen = true)}
				>
					+ Subsidi dari budget lain
				</Button>
			{/if}
		</div>
		{#if entries.length === 0}
			<p class="text-muted-foreground text-xs">Belum ada subsidi untuk budget ini.</p>
		{:else}
			<SubsidyList {entries} onEdit={openSubsidyEdit} />
		{/if}
	</div>
{/if}
```

- [ ] **Step 5: Add the dialogs/sheets at end of template**

After the existing `<AddTransactionSheet ... />` at the bottom (around line 307), append:

```svelte
{#snippet subsidyCreateSnippet()}
	{#if budget}
		{@const overage = spentCents - budget.limitCents}
		{@const cat = allCategoriesById.get(budget.categoryId)}
		<SubsidyCreateForm
			targetBudgetId={budget.id}
			targetCategoryName={cat?.name ?? 'Unknown'}
			targetOverageCents={Math.max(0, overage)}
			alreadyCoveredCents={flow.in}
			eligibleSources={eligibleSources}
			onClose={() => (subsidyOpen = false)}
		/>
	{/if}
{/snippet}

{#snippet subsidyEditSnippet()}
	{#if subsidyEditTarget && budget}
		{@const fromBudget = budgetById.get(subsidyEditTarget.fromBudgetId)}
		{@const toBudget = budgetById.get(subsidyEditTarget.toBudgetId)}
		{@const fromCat = fromBudget ? allCategoriesById.get(fromBudget.categoryId) : null}
		{@const toCat = toBudget ? allCategoriesById.get(toBudget.categoryId) : null}
		{@const fromSpent = fromBudget ? (data.spentByCategory[fromBudget.categoryId] ?? 0) : 0}
		{@const fromFlowOut = fromBudget ? (data.subsidyFlowByBudget[fromBudget.id]?.out ?? 0) : 0}
		{@const remainingExclSelf =
			(fromBudget?.limitCents ?? 0) - fromSpent - fromFlowOut + subsidyEditTarget.amountCents}
		<SubsidyEditForm
			subsidyId={subsidyEditTarget.id}
			fromName={fromCat?.name ?? 'Unknown'}
			toName={toCat?.name ?? 'Unknown'}
			currentAmountCents={subsidyEditTarget.amountCents}
			sourceRemainingExclSelfCents={remainingExclSelf}
			currentNote={subsidyEditTarget.note}
			onClose={() => (subsidyEditOpen = false)}
		/>
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={subsidyOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Subsidi budget</Dialog.Title></Dialog.Header>
			{@render subsidyCreateSnippet()}
		</Dialog.Content>
	</Dialog.Root>
	<Dialog.Root bind:open={subsidyEditOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit subsidi</Dialog.Title></Dialog.Header>
			{@render subsidyEditSnippet()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={subsidyOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Subsidi budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render subsidyCreateSnippet()}</div>
		</Sheet.Content>
	</Sheet.Root>
	<Sheet.Root bind:open={subsidyEditOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Edit subsidi</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render subsidyEditSnippet()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
```

- [ ] **Step 6: Type check + smoke test**

Run: `npm run check`
Expected: PASS.

Run `npm run dev`, navigate to a budget detail page, verify:
- Effective limit shows under Limit when subsidy exists.
- "+ Subsidi dari budget lain" button only renders when this budget is still overspent.
- Subsidy panel lists in/out entries with edit + delete.
- Edit and delete flows work end-to-end.

- [ ] **Step 7: Commit**

```bash
git add src/routes/\(app\)/budgets/\[id\]/+page.svelte
git commit -m "feat(budget-detail): subsidy panel + effective limit display"
```

---

## Task 14: Demo seed sample subsidy

**Files:**
- Modify: `src/lib/server/demo-seed.ts`

- [ ] **Step 1: Inspect the seed file**

Run: `npm run dev` (or just open the file in editor).

Read `src/lib/server/demo-seed.ts` end-to-end to find:
- Where budgets are seeded (look for `INSERT INTO budgets` or `createBudget`).
- Where transactions are seeded.

Pick one expense category that ends up overspent vs its budget (or adjust spending so one category exceeds its limit by ~200k–500k). Pick a second category whose budget has remaining slack of at least the amount you want to subsidize.

- [ ] **Step 2: Insert subsidy after budgets + transactions exist**

In the seed flow, AFTER all budgets and transactions have been inserted, add code that creates a `budgetSubsidies` row. If the file uses raw Drizzle inserts, follow that pattern:

```ts
import { budgetSubsidies } from '$lib/server/db/schema';
// ...
const now = Date.now();
await db.insert(budgetSubsidies).values({
	userId: user.id,
	periodMonth: currentPeriodMonth, // use whatever variable holds the seeded period
	fromBudgetId: transportBudgetId,  // use the seeded budget id for the source
	toBudgetId: foodBudgetId,         // overspent target
	amountCents: 200_000,
	note: 'Demo subsidi: makan akhir bulan',
	createdAt: now,
	updatedAt: now
});
```

Match the import path / `await` / `id` patterns used by surrounding seed inserts.

- [ ] **Step 3: Test demo seed**

Reset/recreate a demo user (whichever path the project uses — likely sign-up flow or a script). Sign in. Navigate to `/budgets`. Confirm:
- One card shows "↓ disubsidi …".
- The matching source card shows "↑ subsidi keluar …".
- The summary line under "Spent vs Budget" says "Subsidi aktif: 1 record".

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/demo-seed.ts
git commit -m "feat(demo): seed sample budget subsidy"
```

---

## Task 15: Final verification

- [ ] **Step 1: Full test run**

Run: `npm run test:unit -- --run`
Expected: All tests PASS, zero failures.

- [ ] **Step 2: Type check + lint**

Run: `npm run check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Full manual walkthrough**

Run `npm run dev`. Walk through each of these flows in the browser:

1. Overspent card shows "Subsidi dari budget lain" button.
2. Button is disabled when no eligible source exists.
3. Create subsidy from card → bar updates, source card now shows outflow.
4. Open detail page of subsidized budget → effective limit visible, subsidy panel lists entry.
5. Edit subsidy from list → amount updates after submit; toast shows.
6. Delete subsidy → entry disappears, bar reverts.
7. Validation: try to subsidize more than `min(overage, source slack)` → server rejects with error toast.
8. Mobile (resize browser to <768px) → all flows open as Sheet not Dialog.

- [ ] **Step 4: Confirm no untracked artifacts**

Run: `git status`
Expected: clean.

---

## Out of Scope (Reminder)

These items from the spec are intentionally not implemented:
- Auto-distribution rules
- Multi-source-in-one-form UI
- Cross-period subsidies
- Multi-currency conversion
- Approval workflows
