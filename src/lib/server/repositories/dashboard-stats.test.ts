import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	computeSpendingByCategory,
	computeDailySpending,
	computeMonthlyIncomeExpense,
	computeFinancialHealth
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
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-food', h.userId, 'Food', 'expense', 'variable', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-transport', h.userId, 'Transport', 'expense', 'variable', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-rent', h.userId, 'Home Rent', 'expense', 'fixed', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-salary', h.userId, 'Salary', 'income', 'variable', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-loan', h.userId, 'Loan Proceeds', 'income', 'variable', now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-adjust', h.userId, 'Balance Adjustment', 'income', 'variable', now, now);
});

const insertTx = (
	id: string,
	categoryId: string | null,
	kind: 'income' | 'expense' | 'transfer',
	amount: number,
	occurredAt: number
) => {
	const cat = categoryId ? `'${categoryId}'` : 'NULL';
	h.sqlite
		.prepare(
			`INSERT INTO transactions VALUES (?, ?, 'acc1', ${cat}, ?, ?, NULL, ?, ?, ?, NULL, NULL, 0)`
		)
		.run(id, h.userId, amount, kind, occurredAt, occurredAt, occurredAt);
};

describe('computeSpendingByCategory', () => {
	it('groups expenses by category for the month, sorted desc', async () => {
		insertTx('t1', 'cat-food', 'expense', 50000, apr2026Day(5));
		insertTx('t2', 'cat-food', 'expense', 30000, apr2026Day(10));
		insertTx('t3', 'cat-transport', 'expense', 100000, apr2026Day(15));
		insertTx('t4', 'cat-food', 'income', 999, apr2026Day(8));
		const rows = await computeSpendingByCategory(h.db, h.userId, '2026-04', 1, 'UTC');
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ categoryId: 'cat-transport', amountCents: 100000 });
		expect(rows[1]).toMatchObject({ categoryId: 'cat-food', amountCents: 80000 });
	});

	it('skips uncategorized expenses', async () => {
		insertTx('t1', null, 'expense', 50000, apr2026Day(5));
		insertTx('t2', 'cat-food', 'expense', 30000, apr2026Day(10));
		const rows = await computeSpendingByCategory(h.db, h.userId, '2026-04', 1, 'UTC');
		expect(rows).toHaveLength(1);
		expect(rows[0].categoryId).toBe('cat-food');
	});
});

describe('computeDailySpending', () => {
	it('returns one entry per day in month with zero-fill', async () => {
		insertTx('t1', 'cat-food', 'expense', 50000, apr2026Day(5));
		insertTx('t2', 'cat-food', 'expense', 30000, apr2026Day(5));
		insertTx('t3', 'cat-food', 'expense', 100000, apr2026Day(15));
		const rows = await computeDailySpending(h.db, h.userId, '2026-04', 1, 'UTC');
		expect(rows).toHaveLength(30);
		expect(rows[4].amountCents).toBe(80000);
		expect(rows[5].amountCents).toBe(0);
		expect(rows[14].amountCents).toBe(100000);
	});

	it('income rows do not contribute', async () => {
		insertTx('t1', 'cat-food', 'income', 99999, apr2026Day(5));
		const rows = await computeDailySpending(h.db, h.userId, '2026-04', 1, 'UTC');
		expect(rows.every((r) => r.amountCents === 0)).toBe(true);
	});
});

describe('computeMonthlyIncomeExpense', () => {
	it('returns last N months in chronological order', async () => {
		insertTx('t1', 'cat-food', 'expense', 100000, Date.UTC(2026, 1, 15));
		insertTx('t2', 'cat-food', 'income', 200000, Date.UTC(2026, 1, 20));
		insertTx('t3', 'cat-food', 'expense', 50000, Date.UTC(2026, 3, 10));
		const rows = await computeMonthlyIncomeExpense(h.db, h.userId, 6, '2026-04', 1, 'UTC');
		expect(rows).toHaveLength(6);
		expect(rows[0].periodMonth).toBe('2025-11');
		expect(rows[5].periodMonth).toBe('2026-04');
		const feb = rows.find((r) => r.periodMonth === '2026-02');
		expect(feb).toMatchObject({ incomeCents: 200000, expenseCents: 100000 });
		const apr = rows.find((r) => r.periodMonth === '2026-04');
		expect(apr).toMatchObject({ incomeCents: 0, expenseCents: 50000 });
	});
});

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
			{
				categoryId: 'cat-food',
				categoryName: 'Food',
				amountCents: 2_500_000,
				expenseType: 'variable'
			},
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
