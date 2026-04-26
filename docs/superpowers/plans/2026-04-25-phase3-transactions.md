# Phase 3 Implementation Plan (Transactions + Balance + Dashboard wire-up)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add transactions (income/expense) CRUD with date-range + account + category + kind filters, compute live account balances, and replace dashboard stub cards with real metrics (net worth, this month spending, recent activity).

**Architecture:** New `(app)/transactions` route. Reuses dialogs + table + repository pattern from Phase 2. Balance computation is a Drizzle aggregate query: `initial_balance_cents + SUM(income) - SUM(expense)` per account. Dashboard pulls from the same balance helper plus a fresh "this month" + "recent" query.

**Out of scope (deferred):**
- `transfer` kind (Phase 4 — needs schema field `transfer_to_account_id` OR paired-rows pattern)
- Editable transactions (edit lands here; delete is hard-delete, no soft-archive — atomic data)
- Recurring transactions (Phase 5 if at all)
- CSV import (Phase 5)

**Tech Stack:** Same as Phase 2.

**Conventions:**
- `<NEW_REPO>` = `/Users/candratama/Project/WebDev/mavlo`
- Branch: `main` (greenfield, branch strategy A)
- Money: integer cents
- `occurredAt` / `createdAt` / `updatedAt`: epoch ms

---

## Task 1: Transactions Validation Schemas

**Files:**
- Create: `<NEW_REPO>/src/lib/validation/transaction.ts`
- Create: `<NEW_REPO>/src/lib/validation/transaction.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/validation/transaction.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionListFilterSchema
} from './transaction';

describe('transaction validation', () => {
	const validBase = {
		accountId: 'acc1',
		amountCents: 50000,
		kind: 'expense',
		occurredAt: Date.now()
	};

	it('create requires accountId, amountCents > 0, kind, occurredAt', () => {
		expect(transactionCreateSchema.safeParse(validBase).success).toBe(true);
		expect(transactionCreateSchema.safeParse({ ...validBase, accountId: '' }).success).toBe(false);
		expect(transactionCreateSchema.safeParse({ ...validBase, amountCents: 0 }).success).toBe(false);
		expect(transactionCreateSchema.safeParse({ ...validBase, amountCents: -100 }).success).toBe(false);
		expect(transactionCreateSchema.safeParse({ ...validBase, kind: 'transfer' }).success).toBe(false);
	});

	it('create allows optional categoryId + note', () => {
		expect(
			transactionCreateSchema.safeParse({ ...validBase, categoryId: 'cat1', note: 'lunch' }).success
		).toBe(true);
	});

	it('create coerces empty categoryId to null/undefined', () => {
		const r = transactionCreateSchema.safeParse({ ...validBase, categoryId: '' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.categoryId).toBeUndefined();
	});

	it('update requires id', () => {
		expect(
			transactionUpdateSchema.safeParse({ ...validBase, id: 'tx1' }).success
		).toBe(true);
		expect(transactionUpdateSchema.safeParse(validBase).success).toBe(false);
	});

	it('list filter accepts optional fromMs/toMs/accountId/categoryId/kind', () => {
		expect(transactionListFilterSchema.safeParse({}).success).toBe(true);
		expect(
			transactionListFilterSchema.safeParse({
				fromMs: 1000,
				toMs: 2000,
				accountId: 'acc1',
				kind: 'income'
			}).success
		).toBe(true);
		expect(
			transactionListFilterSchema.safeParse({ kind: 'invalid' }).success
		).toBe(false);
	});
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 3: Create `src/lib/validation/transaction.ts`**

```typescript
import { z } from 'zod';

export const transactionKindEnum = z.enum(['income', 'expense']);

const emptyToUndefined = z.literal('').transform(() => undefined);

export const transactionCreateSchema = z.object({
	accountId: z.string().min(1, 'Account required'),
	categoryId: z.string().min(1).optional().or(emptyToUndefined),
	amountCents: z.coerce.number().int().positive('Amount must be positive'),
	kind: transactionKindEnum,
	note: z.string().trim().max(200).optional().or(emptyToUndefined),
	occurredAt: z.coerce.number().int().positive('Date required')
});

export const transactionUpdateSchema = transactionCreateSchema.extend({
	id: z.string().min(1, 'Id required')
});

export const transactionIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export const transactionListFilterSchema = z.object({
	fromMs: z.coerce.number().int().optional(),
	toMs: z.coerce.number().int().optional(),
	accountId: z.string().min(1).optional().or(emptyToUndefined),
	categoryId: z.string().min(1).optional().or(emptyToUndefined),
	kind: transactionKindEnum.optional()
});

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListFilter = z.infer<typeof transactionListFilterSchema>;
export type TransactionKind = z.infer<typeof transactionKindEnum>;
```

- [ ] **Step 4: Run (expect PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 5: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/validation/transaction" || echo "no errors in transaction validators"
git add src/lib/validation/transaction.ts src/lib/validation/transaction.test.ts
git commit -m "feat(validation): zod schemas for transactions"
```

---

## Task 2: Extend Test Fixture for Transactions

**Files:**
- Modify: `<NEW_REPO>/src/lib/server/db/test-fixtures.ts`

Add `transactions` table to the in-memory fixture so the transactions repo can test against it. Also seed accounts + categories on demand for tests that need them.

- [ ] **Step 1: Update `src/lib/server/db/test-fixtures.ts`**

Add a new SQL string + extend the `tables` opt + extend the seed signature:

```typescript
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const usersTableSql = `
	CREATE TABLE users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		email_verified INTEGER DEFAULT 0 NOT NULL,
		image TEXT,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

const accountsTableSql = `
	CREATE TABLE accounts (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		currency TEXT NOT NULL DEFAULT 'IDR',
		initial_balance_cents INTEGER NOT NULL DEFAULT 0,
		archived INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

const categoriesTableSql = `
	CREATE TABLE categories (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		kind TEXT NOT NULL,
		color TEXT,
		icon TEXT,
		archived INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

const transactionsTableSql = `
	CREATE TABLE transactions (
		id TEXT NOT NULL PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
		category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
		amount_cents INTEGER NOT NULL,
		kind TEXT NOT NULL,
		note TEXT,
		occurred_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	)
`;

export interface TestDbHandle {
	db: BetterSQLite3Database<typeof schema>;
	userId: string;
	otherUserId: string;
	sqlite: Database.Database;
}

export function createTestDb(opts: {
	tables: ('accounts' | 'categories' | 'transactions')[];
}): TestDbHandle {
	const sqlite = new Database(':memory:');
	const db = drizzle(sqlite, { schema });

	sqlite.prepare(usersTableSql).run();
	if (opts.tables.includes('accounts')) sqlite.prepare(accountsTableSql).run();
	if (opts.tables.includes('categories')) sqlite.prepare(categoriesTableSql).run();
	if (opts.tables.includes('transactions')) sqlite.prepare(transactionsTableSql).run();

	const now = Date.now();
	const userId = 'user_test_1';
	const otherUserId = 'user_test_2';
	sqlite
		.prepare('INSERT INTO users VALUES (?, ?, ?, 0, NULL, ?, ?)')
		.run(userId, 'A', 'a@b.co', now, now);
	sqlite
		.prepare('INSERT INTO users VALUES (?, ?, ?, 0, NULL, ?, ?)')
		.run(otherUserId, 'B', 'b@b.co', now, now);

	return { db, userId, otherUserId, sqlite };
}
```

Also exports `sqlite` so tests can seed accounts/categories using raw SQL when convenient (avoids forcing every test to import the Phase 2 repos).

- [ ] **Step 2: Type-check (sanity)**

Existing tests in P2T4 / P2T5 use `createTestDb({ tables: ['accounts'] })` etc. They don't reference `sqlite`, so adding the `sqlite` field is backward-compatible.

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

Expected: all 29 existing tests still pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
git add src/lib/server/db/test-fixtures.ts
git commit -m "feat(test): add transactions table to in-memory fixture"
```

---

## Task 3: Transactions Repository

**Files:**
- Create: `<NEW_REPO>/src/lib/server/repositories/transactions.ts`
- Create: `<NEW_REPO>/src/lib/server/repositories/transactions.test.ts`

CRUD plus a filtered list (date range + account + category + kind).

- [ ] **Step 1: Write failing test**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	listTransactions,
	createTransaction,
	updateTransaction,
	deleteTransaction,
	getTransaction
} from './transactions';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions'] });
	const now = Date.now();
	h.sqlite
		.prepare(
			'INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
		)
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare(
			'INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
		)
		.run('acc2', h.otherUserId, 'Other Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('cat1', h.userId, 'Food', 'expense', now, now);
});

describe('transactions repository', () => {
	it('createTransaction + listTransactions returns own', async () => {
		await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 5000,
			kind: 'expense',
			occurredAt: Date.now(),
			categoryId: 'cat1',
			note: 'coffee'
		});
		const list = await listTransactions(h.db, h.userId, {});
		expect(list).toHaveLength(1);
		expect(list[0].note).toBe('coffee');
	});

	it('listTransactions does not return other-user rows even when account_id matches', async () => {
		await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		const otherList = await listTransactions(h.db, h.otherUserId, {});
		expect(otherList).toHaveLength(0);
	});

	it('listTransactions filters by date range', async () => {
		await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: 1000
		});
		await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 2000,
			kind: 'expense',
			occurredAt: 5000
		});
		expect(await listTransactions(h.db, h.userId, { fromMs: 0, toMs: 2000 })).toHaveLength(1);
		expect(await listTransactions(h.db, h.userId, { fromMs: 3000, toMs: 6000 })).toHaveLength(1);
		expect(await listTransactions(h.db, h.userId, { fromMs: 0, toMs: 6000 })).toHaveLength(2);
	});

	it('listTransactions filters by accountId, kind, categoryId', async () => {
		await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'income',
			occurredAt: Date.now()
		});
		await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 2000,
			kind: 'expense',
			categoryId: 'cat1',
			occurredAt: Date.now()
		});
		expect(await listTransactions(h.db, h.userId, { kind: 'income' })).toHaveLength(1);
		expect(await listTransactions(h.db, h.userId, { categoryId: 'cat1' })).toHaveLength(1);
		expect(await listTransactions(h.db, h.userId, { accountId: 'acc1' })).toHaveLength(2);
	});

	it('updateTransaction cross-user returns null', async () => {
		const t = await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		const updated = await updateTransaction(h.db, h.otherUserId, {
			id: t.id,
			accountId: 'acc1',
			amountCents: 9999,
			kind: 'expense',
			occurredAt: Date.now()
		});
		expect(updated).toBeNull();
	});

	it('deleteTransaction works for own; cross-user returns null', async () => {
		const t = await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		expect(await deleteTransaction(h.db, h.otherUserId, t.id)).toBeNull();
		const deleted = await deleteTransaction(h.db, h.userId, t.id);
		expect(deleted?.id).toBe(t.id);
		expect(await getTransaction(h.db, h.userId, t.id)).toBeNull();
	});
});
```

- [ ] **Step 2: Run (FAIL)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 3: Create `src/lib/server/repositories/transactions.ts`**

```typescript
import { and, between, desc, eq, type SQL } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type {
	TransactionCreateInput,
	TransactionUpdateInput,
	TransactionListFilter
} from '$lib/validation/transaction';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function listTransactions(
	db: Db,
	userId: string,
	filter: TransactionListFilter
) {
	const conds: SQL[] = [eq(transactions.userId, userId)];
	if (filter.fromMs !== undefined && filter.toMs !== undefined) {
		conds.push(between(transactions.occurredAt, filter.fromMs, filter.toMs));
	} else if (filter.fromMs !== undefined) {
		conds.push(eq(transactions.occurredAt, filter.fromMs));
	}
	if (filter.accountId) conds.push(eq(transactions.accountId, filter.accountId));
	if (filter.categoryId) conds.push(eq(transactions.categoryId, filter.categoryId));
	if (filter.kind) conds.push(eq(transactions.kind, filter.kind));

	return db
		.select()
		.from(transactions)
		.where(and(...conds))
		.orderBy(desc(transactions.occurredAt));
}

export async function getTransaction(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(transactions)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.limit(1);
	return row ?? null;
}

export async function createTransaction(
	db: Db,
	userId: string,
	input: TransactionCreateInput
) {
	const [row] = await db
		.insert(transactions)
		.values({
			userId,
			accountId: input.accountId,
			categoryId: input.categoryId ?? null,
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt
		})
		.returning();
	return row;
}

export async function updateTransaction(
	db: Db,
	userId: string,
	input: TransactionUpdateInput
) {
	const [row] = await db
		.update(transactions)
		.set({
			accountId: input.accountId,
			categoryId: input.categoryId ?? null,
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt,
			updatedAt: Date.now()
		})
		.where(and(eq(transactions.userId, userId), eq(transactions.id, input.id)))
		.returning();
	return row ?? null;
}

export async function deleteTransaction(db: Db, userId: string, id: string) {
	const [row] = await db
		.delete(transactions)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.returning();
	return row ?? null;
}
```

- [ ] **Step 4: Run (PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 5: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/server/repositories/transactions" || echo "no errors in transactions repo"
git add src/lib/server/repositories/transactions.ts src/lib/server/repositories/transactions.test.ts
git commit -m "feat(repo): transactions repository with filter + CRUD"
```

---

## Task 4: Account Balance Computation

**Files:**
- Create: `<NEW_REPO>/src/lib/server/repositories/balances.ts`
- Create: `<NEW_REPO>/src/lib/server/repositories/balances.test.ts`

Computes per-account balance = `initial_balance_cents + SUM(income.amount_cents) - SUM(expense.amount_cents)`. Returns a map keyed by account ID. Used by accounts page (extension), dashboard.

- [ ] **Step 1: Write failing test**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { computeAccountBalances } from './balances';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 100000, now, now);
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
		.run('acc2', h.userId, 'Bank', 'bank', 'IDR', 500000, now, now);
});

const insertTx = (h: TestDbHandle, args: { id: string; accountId: string; amount: number; kind: 'income' | 'expense' }) => {
	const now = Date.now();
	h.sqlite
		.prepare(
			'INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)'
		)
		.run(args.id, h.userId, args.accountId, args.amount, args.kind, now, now, now);
};

describe('computeAccountBalances', () => {
	it('returns initial_balance when no transactions', async () => {
		const map = await computeAccountBalances(h.db, h.userId);
		expect(map.get('acc1')).toBe(100000);
		expect(map.get('acc2')).toBe(500000);
	});

	it('adds income, subtracts expense', async () => {
		insertTx(h, { id: 't1', accountId: 'acc1', amount: 50000, kind: 'income' });
		insertTx(h, { id: 't2', accountId: 'acc1', amount: 20000, kind: 'expense' });
		const map = await computeAccountBalances(h.db, h.userId);
		expect(map.get('acc1')).toBe(130000);
	});

	it('isolates per-account totals', async () => {
		insertTx(h, { id: 't1', accountId: 'acc1', amount: 50000, kind: 'income' });
		insertTx(h, { id: 't2', accountId: 'acc2', amount: 30000, kind: 'expense' });
		const map = await computeAccountBalances(h.db, h.userId);
		expect(map.get('acc1')).toBe(150000);
		expect(map.get('acc2')).toBe(470000);
	});

	it('cross-user transactions do not affect own balance', async () => {
		const now = Date.now();
		h.sqlite
			.prepare(
				'INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
			)
			.run('acc-other', h.otherUserId, 'Other', 'cash', 'IDR', 0, now, now);
		h.sqlite
			.prepare(
				'INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)'
			)
			.run('tother', h.otherUserId, 'acc-other', 99999, 'expense', now, now, now);

		const map = await computeAccountBalances(h.db, h.userId);
		expect(map.get('acc1')).toBe(100000);
		expect(map.get('acc2')).toBe(500000);
		expect(map.has('acc-other')).toBe(false);
	});
});
```

- [ ] **Step 2: Run (FAIL)**

- [ ] **Step 3: Create `src/lib/server/repositories/balances.ts`**

```typescript
import { eq, sum, sql } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { accounts, transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

/**
 * Returns Map<accountId, balanceCents>. Includes only accounts owned by `userId`.
 * Balance = initial_balance_cents + SUM(income) - SUM(expense). Computed in SQL.
 */
export async function computeAccountBalances(
	db: Db,
	userId: string
): Promise<Map<string, number>> {
	// LEFT JOIN aggregates of own transactions per account.
	// Drizzle's groupBy + sql<number> casts produce per-account totals.
	const rows = await db
		.select({
			id: accounts.id,
			initialBalanceCents: accounts.initialBalanceCents,
			incomeCents: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'income' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
			expenseCents: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`
		})
		.from(accounts)
		.leftJoin(
			transactions,
			sql`${transactions.accountId} = ${accounts.id} AND ${transactions.userId} = ${userId}`
		)
		.where(eq(accounts.userId, userId))
		.groupBy(accounts.id);

	const map = new Map<string, number>();
	for (const r of rows) {
		map.set(r.id, r.initialBalanceCents + r.incomeCents - r.expenseCents);
	}
	return map;
}
```

The unused `sum` import can be removed if your linter complains — kept for readability of intent. The raw `sql\`COALESCE(SUM(CASE WHEN ...))\`` expression is the SQLite-portable way to do conditional aggregation. Drizzle's typed helpers don't have a direct equivalent for `CASE WHEN`.

- [ ] **Step 4: Run (PASS)**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run test
```

- [ ] **Step 5: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/lib/server/repositories/balances" || echo "no errors"
git add src/lib/server/repositories/balances.ts src/lib/server/repositories/balances.test.ts
git commit -m "feat(repo): per-account balance computation via SQL aggregate"
```

---

## Task 5: Transactions List Page + Server Actions

**Files:**
- Create: `<NEW_REPO>/src/routes/(app)/transactions/+page.server.ts`
- Create: `<NEW_REPO>/src/routes/(app)/transactions/+page.svelte`

Filters via query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD&account=<id>&category=<id>&kind=income|expense`. Default range: current month.

- [ ] **Step 1: Create `src/routes/(app)/transactions/+page.server.ts`**

```typescript
import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	listTransactions,
	createTransaction,
	updateTransaction,
	deleteTransaction
} from '$lib/server/repositories/transactions';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionIdSchema,
	transactionListFilterSchema
} from '$lib/validation/transaction';
import type { Actions, PageServerLoad } from './$types';

const dayMs = 24 * 60 * 60 * 1000;

const ymdToMs = (s: string | null): number | undefined => {
	if (!s) return undefined;
	const t = Date.parse(`${s}T00:00:00.000Z`);
	return Number.isNaN(t) ? undefined : t;
};

const startOfMonthUtc = () => {
	const d = new Date();
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

const endOfMonthUtc = () => {
	const d = new Date();
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const url = event.url;
	const fromParam = url.searchParams.get('from');
	const toParam = url.searchParams.get('to');
	const fromMs = ymdToMs(fromParam) ?? startOfMonthUtc();
	const toMs = ymdToMs(toParam) ?? endOfMonthUtc();

	const filter = transactionListFilterSchema.parse({
		fromMs,
		toMs: toMs + dayMs - 1, // include the end-of-day for `to`
		accountId: url.searchParams.get('account') ?? undefined,
		categoryId: url.searchParams.get('category') ?? undefined,
		kind: url.searchParams.get('kind') ?? undefined
	});

	const [items, accounts, categories] = await Promise.all([
		listTransactions(db, user.id, filter),
		listAccounts(db, user.id, { includeArchived: false }),
		listCategories(db, user.id, { includeArchived: false })
	]);

	return {
		transactions: items,
		accounts,
		categories,
		filter: {
			from: fromParam ?? new Date(fromMs).toISOString().slice(0, 10),
			to: toParam ?? new Date(toMs).toISOString().slice(0, 10),
			accountId: url.searchParams.get('account') ?? '',
			categoryId: url.searchParams.get('category') ?? '',
			kind: url.searchParams.get('kind') ?? ''
		}
	};
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

const parseDateMs = (s: FormDataEntryValue | null): number | undefined => {
	if (typeof s !== 'string' || !s) return undefined;
	const ms = ymdToMs(s);
	return ms;
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const occurredAtMs = parseDateMs(fd.get('occurredAt'));
		const parsed = transactionCreateSchema.safeParse({
			...formObject(fd),
			occurredAt: occurredAtMs ?? 0
		});
		if (!parsed.success) {
			return fail(400, { action: 'create', message: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}
		await createTransaction(db, user.id, parsed.data);
		return { success: true, action: 'create' };
	},
	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const occurredAtMs = parseDateMs(fd.get('occurredAt'));
		const parsed = transactionUpdateSchema.safeParse({
			...formObject(fd),
			occurredAt: occurredAtMs ?? 0
		});
		if (!parsed.success) {
			return fail(400, { action: 'update', message: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}
		const updated = await updateTransaction(db, user.id, parsed.data);
		if (!updated) return fail(404, { action: 'update', message: 'Transaction not found' });
		return { success: true, action: 'update' };
	},
	delete: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = transactionIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'delete', message: 'Invalid id' });
		const deleted = await deleteTransaction(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'delete', message: 'Transaction not found' });
		return { success: true, action: 'delete' };
	}
};
```

- [ ] **Step 2: Create `src/routes/(app)/transactions/+page.svelte`**

Long file but mostly mechanical: filter bar (5 inputs + apply), table of rows, create dialog, edit dialog, delete via row dropdown.

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-svelte';

	let { data, form } = $props();

	type TxRow = (typeof data.transactions)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);

	const expenseCategories = $derived(data.categories.filter((c) => c.kind === 'expense'));
	const incomeCategories = $derived(data.categories.filter((c) => c.kind === 'income'));

	const accountById = $derived(new Map(data.accounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const formatAmount = (cents: number, currency: string) =>
		new Intl.NumberFormat('id-ID', { style: 'currency', currency, minimumFractionDigits: 0 }).format(
			cents / 100
		);

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	const todayYmd = new Date().toISOString().slice(0, 10);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editOpen = true;
	};
</script>

<svelte:head><title>Transactions — Mavlo</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-semibold">Transactions</h1>
		<p class="text-sm text-muted-foreground mt-1">Track inflows and outflows.</p>
	</div>
	<Button onclick={() => (createOpen = true)}>
		<Plus class="size-4 mr-1" /> New transaction
	</Button>
</div>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

<Card.Root class="mb-6">
	<Card.Content class="p-4">
		<form method="GET" class="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
			<div class="space-y-1">
				<Label for="filter-from">From</Label>
				<Input id="filter-from" type="date" name="from" value={data.filter.from} />
			</div>
			<div class="space-y-1">
				<Label for="filter-to">To</Label>
				<Input id="filter-to" type="date" name="to" value={data.filter.to} />
			</div>
			<div class="space-y-1">
				<Label for="filter-account">Account</Label>
				<select
					id="filter-account"
					name="account"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value="">All</option>
					{#each data.accounts as a}
						<option value={a.id} selected={data.filter.accountId === a.id}>{a.name}</option>
					{/each}
				</select>
			</div>
			<div class="space-y-1">
				<Label for="filter-category">Category</Label>
				<select
					id="filter-category"
					name="category"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value="">All</option>
					{#each data.categories as c}
						<option value={c.id} selected={data.filter.categoryId === c.id}>
							{c.name} ({c.kind})
						</option>
					{/each}
				</select>
			</div>
			<div class="space-y-1">
				<Label for="filter-kind">Kind</Label>
				<select
					id="filter-kind"
					name="kind"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value="">All</option>
					<option value="income" selected={data.filter.kind === 'income'}>Income</option>
					<option value="expense" selected={data.filter.kind === 'expense'}>Expense</option>
				</select>
			</div>
			<Button type="submit" class="w-full md:w-auto">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

<Card.Root>
	<Card.Content class="p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Date</Table.Head>
					<Table.Head>Kind</Table.Head>
					<Table.Head>Account</Table.Head>
					<Table.Head>Category</Table.Head>
					<Table.Head>Note</Table.Head>
					<Table.Head class="text-right">Amount</Table.Head>
					<Table.Head class="w-12"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.transactions as tx (tx.id)}
					{@const acc = accountById.get(tx.accountId)}
					{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
					<Table.Row>
						<Table.Cell>{formatDate(tx.occurredAt)}</Table.Cell>
						<Table.Cell class="capitalize">
							<span class={tx.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
								{tx.kind}
							</span>
						</Table.Cell>
						<Table.Cell>{acc?.name ?? '—'}</Table.Cell>
						<Table.Cell>{cat?.name ?? '—'}</Table.Cell>
						<Table.Cell class="max-w-xs truncate">{tx.note ?? ''}</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{tx.kind === 'expense' ? '−' : '+'}
							{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}
						</Table.Cell>
						<Table.Cell>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button {...props} variant="ghost" size="icon" class="size-8">
											<MoreHorizontal class="size-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<DropdownMenu.Item onclick={() => openEdit(tx)}>
										<Pencil class="size-4 mr-2" /> Edit
									</DropdownMenu.Item>
									<form method="POST" action="?/delete" use:enhance>
										<input type="hidden" name="id" value={tx.id} />
										<DropdownMenu.Item>
											{#snippet child({ props })}
												<button {...props} type="submit" class="w-full text-left text-destructive">
													<Trash2 class="size-4 mr-2" /> Delete
												</button>
											{/snippet}
										</DropdownMenu.Item>
									</form>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={7} class="text-center text-muted-foreground py-12">
							No transactions in this range.
							<Button variant="link" onclick={() => (createOpen = true)} class="px-1">
								Add the first one
							</Button>.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>

<!-- Create dialog -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>New transaction</Dialog.Title>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => async ({ update, result }) => {
				await update();
				if (result.type === 'success') createOpen = false;
			}}
			class="space-y-4"
		>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="tx-c-kind">Kind</Label>
					<select
						id="tx-c-kind"
						name="kind"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="expense">Expense</option>
						<option value="income">Income</option>
					</select>
				</div>
				<div class="space-y-1">
					<Label for="tx-c-amount">Amount (cents)</Label>
					<Input id="tx-c-amount" type="number" name="amountCents" min="1" required />
				</div>
			</div>
			<div class="space-y-1">
				<Label for="tx-c-account">Account</Label>
				<select
					id="tx-c-account"
					name="accountId"
					required
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					{#each data.accounts as a}
						<option value={a.id}>{a.name} ({a.currency})</option>
					{/each}
				</select>
			</div>
			<div class="space-y-1">
				<Label for="tx-c-category">Category (optional)</Label>
				<select
					id="tx-c-category"
					name="categoryId"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value="">None</option>
					<optgroup label="Expense">
						{#each expenseCategories as c}
							<option value={c.id}>{c.name}</option>
						{/each}
					</optgroup>
					<optgroup label="Income">
						{#each incomeCategories as c}
							<option value={c.id}>{c.name}</option>
						{/each}
					</optgroup>
				</select>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="tx-c-date">Date</Label>
					<Input id="tx-c-date" type="date" name="occurredAt" required value={todayYmd} />
				</div>
				<div class="space-y-1">
					<Label for="tx-c-note">Note</Label>
					<Input id="tx-c-note" name="note" maxlength={200} placeholder="optional" />
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
			<Dialog.Title>Edit transaction</Dialog.Title>
		</Dialog.Header>
		{#if editTarget}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => async ({ update, result }) => {
					await update();
					if (result.type === 'success') editOpen = false;
				}}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={editTarget.id} />
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="tx-e-kind">Kind</Label>
						<select
							id="tx-e-kind"
							name="kind"
							required
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="expense" selected={editTarget.kind === 'expense'}>Expense</option>
							<option value="income" selected={editTarget.kind === 'income'}>Income</option>
						</select>
					</div>
					<div class="space-y-1">
						<Label for="tx-e-amount">Amount (cents)</Label>
						<Input
							id="tx-e-amount"
							type="number"
							name="amountCents"
							min="1"
							required
							value={editTarget.amountCents}
						/>
					</div>
				</div>
				<div class="space-y-1">
					<Label for="tx-e-account">Account</Label>
					<select
						id="tx-e-account"
						name="accountId"
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{#each data.accounts as a}
							<option value={a.id} selected={a.id === editTarget.accountId}>
								{a.name} ({a.currency})
							</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1">
					<Label for="tx-e-category">Category (optional)</Label>
					<select
						id="tx-e-category"
						name="categoryId"
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="" selected={!editTarget.categoryId}>None</option>
						<optgroup label="Expense">
							{#each expenseCategories as c}
								<option value={c.id} selected={c.id === editTarget.categoryId}>{c.name}</option>
							{/each}
						</optgroup>
						<optgroup label="Income">
							{#each incomeCategories as c}
								<option value={c.id} selected={c.id === editTarget.categoryId}>{c.name}</option>
							{/each}
						</optgroup>
					</select>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="tx-e-date">Date</Label>
						<Input
							id="tx-e-date"
							type="date"
							name="occurredAt"
							required
							value={formatDate(editTarget.occurredAt)}
						/>
					</div>
					<div class="space-y-1">
						<Label for="tx-e-note">Note</Label>
						<Input id="tx-e-note" name="note" maxlength={200} value={editTarget.note ?? ''} />
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

- [ ] **Step 3: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/transactions" || echo "no errors"
git add "src/routes/(app)/transactions/"
git commit -m "feat(transactions): list page with filters + CRUD dialogs"
```

---

## Task 6: Wire Dashboard With Real Metrics

**Files:**
- Modify: `<NEW_REPO>/src/routes/(app)/dashboard/+page.server.ts`
- Modify: `<NEW_REPO>/src/routes/(app)/dashboard/+page.svelte`

Replace the empty `load` and stub cards with real values:
- **Net worth:** sum of all account balances (one currency for now — IDR; mixed-currency totals deferred to settings/conversion)
- **This month:** total expense (cents) for current month, in default currency
- **Recent activity:** last 5 transactions

- [ ] **Step 1: Update `src/routes/(app)/dashboard/+page.server.ts`**

```typescript
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import { listTransactions } from '$lib/server/repositories/transactions';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const now = new Date();
	const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
	const monthEndMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1;

	const [balances, monthTxns, recentTxns, accounts, categories] = await Promise.all([
		computeAccountBalances(db, user.id),
		listTransactions(db, user.id, { fromMs: monthStartMs, toMs: monthEndMs }),
		listTransactions(db, user.id, {}),
		listAccounts(db, user.id, { includeArchived: false }),
		listCategories(db, user.id, { includeArchived: false })
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
		// `data.user` and `data.preferences` come from (app)/+layout.server.ts
		// but we re-export the currency for convenience
		displayCurrency: 'IDR'
	};
};
```

- [ ] **Step 2: Update `src/routes/(app)/dashboard/+page.svelte`**

```svelte
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight } from 'lucide-svelte';

	let { data } = $props();

	const formatCents = (cents: number, currency: string) =>
		new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency,
			minimumFractionDigits: 0
		}).format(cents / 100);

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
</script>

<svelte:head><title>Dashboard — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold">Dashboard</h1>
<p class="mt-2 text-sm text-muted-foreground">
	Welcome, {data.user.name}. Currency: {data.preferences.currency} · Locale: {data.preferences.locale}
</p>

<div class="mt-8 grid gap-4 md:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<Card.Description>Net worth</Card.Description>
			<Card.Title class="text-2xl tabular-nums">
				{formatCents(data.netWorthCents, data.displayCurrency)}
			</Card.Title>
		</Card.Header>
		<Card.Content class="text-xs text-muted-foreground">
			Sum of all account balances.
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Description>This month spending</Card.Description>
			<Card.Title class="text-2xl tabular-nums text-rose-600 dark:text-rose-400">
				{formatCents(data.monthExpenseCents, data.displayCurrency)}
			</Card.Title>
		</Card.Header>
		<Card.Content class="text-xs text-muted-foreground">
			Income: <span class="text-emerald-600 dark:text-emerald-400">{formatCents(data.monthIncomeCents, data.displayCurrency)}</span>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Description>Recent activity</Card.Description>
			<Card.Title class="text-2xl">{data.recent.length}</Card.Title>
		</Card.Header>
		<Card.Content class="text-xs text-muted-foreground">
			Last {data.recent.length} transaction{data.recent.length === 1 ? '' : 's'}.
		</Card.Content>
	</Card.Root>
</div>

<Card.Root class="mt-8">
	<Card.Header class="flex flex-row items-center justify-between">
		<Card.Title>Recent transactions</Card.Title>
		<Button variant="ghost" size="sm" href="/transactions">
			View all <ArrowRight class="size-4 ml-1" />
		</Button>
	</Card.Header>
	<Card.Content class="p-0">
		{#if data.recent.length === 0}
			<p class="text-sm text-muted-foreground p-6 text-center">
				No transactions yet. <a href="/transactions" class="underline">Add one</a>.
			</p>
		{:else}
			<ul class="divide-y">
				{#each data.recent as r}
					<li class="px-6 py-3 flex items-center justify-between text-sm">
						<div class="flex flex-col">
							<span class="font-medium">{r.note || r.categoryName || r.accountName || 'Transaction'}</span>
							<span class="text-xs text-muted-foreground">
								{formatDate(r.occurredAt)} · {r.accountName ?? '—'}
								{#if r.categoryName} · {r.categoryName}{/if}
							</span>
						</div>
						<span class={r.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400 tabular-nums' : 'text-rose-600 dark:text-rose-400 tabular-nums'}>
							{r.kind === 'expense' ? '−' : '+'}{formatCents(r.amountCents, r.accountCurrency)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
```

- [ ] **Step 3: Type-check + Commit**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npm run check 2>&1 | grep -E "src/routes/\\(app\\)/dashboard" || echo "no errors"
git add "src/routes/(app)/dashboard/"
git commit -m "feat(dashboard): wire net worth, month spending, recent transactions"
```

---

## Task 7: Build + Smoke + Deploy

**Files:** none (verification + deploy)

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

echo "=== /transactions ==="
curl -sI http://localhost:4173/transactions | head -5
echo ""
echo "=== /dashboard ==="
curl -sI http://localhost:4173/dashboard | head -5
echo ""
echo "=== /api/health ==="
curl -s http://localhost:4173/api/health

kill $PREVIEW_PID 2>/dev/null
sleep 2
```

Expected: both routes 302 → /sign-in; health up.

- [ ] **Step 3: Deploy**

```bash
cd /Users/candratama/Project/WebDev/mavlo
npx wrangler deploy 2>&1 | tail -30
```

If transient Cloudflare 10500/10001 errors hit (seen in P2T8), retry up to 2 times.

- [ ] **Step 4: Deployed smoke**

```bash
curl -s https://mavlo.wahyucandratama.workers.dev/api/health
curl -sI https://mavlo.wahyucandratama.workers.dev/transactions | head -5
curl -sI https://mavlo.wahyucandratama.workers.dev/dashboard | head -5
```

- [ ] **Step 5: User runs manual e2e:**
  - Sign in
  - Visit /accounts: confirm at least one exists; create one if not
  - Visit /categories: create at least one income + one expense category
  - Visit /transactions: filter bar shows; add an income txn + an expense txn; edit one; delete one
  - Visit /dashboard: net worth + this month + recent transactions all reflect real data

- [ ] **Step 6: NO commit** (verification).

---

## Phase 3 Done When

- [ ] `/transactions` lists user txns with date-range + account + category + kind filters
- [ ] Create/edit/delete actions all validate via zod and respect user scoping
- [ ] Account balance helper computes initial + income - expense per account, in SQL
- [ ] `/dashboard` shows real net worth, this month spending vs income, last 5 transactions list with sign + currency
- [ ] All Phase 3 unit tests pass
- [ ] Build + deploy clean

## Out of Scope for Phase 3 (deferred)

- `transfer` kind (Phase 4 — needs schema field or paired-rows)
- Budgets pages (Phase 4)
- Settings page (Phase 4)
- Charts, PWA, R2 avatar upload (Phase 5)
- CSV import/export (later)
