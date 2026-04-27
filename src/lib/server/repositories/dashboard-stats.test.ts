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
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-food', h.userId, 'Food', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
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
		insertTx('t4', 'cat-food', 'income', 999, apr2026Day(8));
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
		expect(rows).toHaveLength(30);
		expect(rows[4].amountCents).toBe(80000);
		expect(rows[5].amountCents).toBe(0);
		expect(rows[14].amountCents).toBe(100000);
	});

	it('income rows do not contribute', async () => {
		insertTx('t1', 'cat-food', 'income', 99999, apr2026Day(5));
		const rows = await computeDailySpending(h.db, h.userId, '2026-04');
		expect(rows.every((r) => r.amountCents === 0)).toBe(true);
	});
});

describe('computeMonthlyIncomeExpense', () => {
	it('returns last N months in chronological order', async () => {
		insertTx('t1', 'cat-food', 'expense', 100000, Date.UTC(2026, 1, 15));
		insertTx('t2', 'cat-food', 'income', 200000, Date.UTC(2026, 1, 20));
		insertTx('t3', 'cat-food', 'expense', 50000, Date.UTC(2026, 3, 10));
		const rows = await computeMonthlyIncomeExpense(h.db, h.userId, 6, '2026-04');
		expect(rows).toHaveLength(6);
		expect(rows[0].periodMonth).toBe('2025-11');
		expect(rows[5].periodMonth).toBe('2026-04');
		const feb = rows.find((r) => r.periodMonth === '2026-02');
		expect(feb).toMatchObject({ incomeCents: 200000, expenseCents: 100000 });
		const apr = rows.find((r) => r.periodMonth === '2026-04');
		expect(apr).toMatchObject({ incomeCents: 0, expenseCents: 50000 });
	});
});
