import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { computeBudgetSpent } from './budget-spent';

let h: TestDbHandle;

const apr2026Mid = Date.UTC(2026, 3, 15);
const may2026 = Date.UTC(2026, 4, 1);
const apr2026FromMs = Date.UTC(2026, 3, 1);
const apr2026ToMs = Date.UTC(2026, 4, 1) - 1;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions', 'budgets'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare(
			'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
		)
		.run('cat1', h.userId, 'Food', 'expense', now, now);
});

const insertTx = (
	id: string,
	categoryId: string | null,
	kind: 'income' | 'expense' | 'transfer',
	amount: number,
	occurredAt: number,
	options: { userId?: string; accountId?: string; transferTo?: string } = {}
) => {
	const cat = categoryId ? `'${categoryId}'` : 'NULL';
	const transferTo = options.transferTo ? `'${options.transferTo}'` : 'NULL';
	const userId = options.userId ?? h.userId;
	const accountId = options.accountId ?? 'acc1';
	h.sqlite
		.prepare(
			`INSERT INTO transactions VALUES (?, ?, ?, ${cat}, ?, ?, NULL, ?, ?, ?, ${transferTo}, NULL, 0)`
		)
		.run(id, userId, accountId, amount, kind, occurredAt, occurredAt, occurredAt);
};

describe('computeBudgetSpent', () => {
	it('sums expense by category for the month', async () => {
		insertTx('t1', 'cat1', 'expense', 50000, apr2026Mid);
		insertTx('t2', 'cat1', 'expense', 30000, apr2026Mid + 1);
		insertTx('t3', 'cat1', 'income', 100000, apr2026Mid); // ignored — income
		insertTx('t4', 'cat1', 'expense', 99999, may2026); // ignored — wrong month
		insertTx('t5', null, 'expense', 5000, apr2026Mid); // ignored — no category

		const map = await computeBudgetSpent(h.db, h.userId, apr2026FromMs, apr2026ToMs);
		expect(map.get('cat1')).toBe(80000);
	});

	it('cross-user expenses do not count', async () => {
		const otherNow = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
			.run('acc-other', h.otherUserId, 'Other', 'cash', 'IDR', 0, otherNow, otherNow);
		h.sqlite
			.prepare(
				'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
			)
			.run('cat1-other', h.otherUserId, 'Food', 'expense', otherNow, otherNow);
		insertTx('tx-other', 'cat1-other', 'expense', 123456, apr2026Mid, {
			userId: h.otherUserId,
			accountId: 'acc-other'
		});

		const map = await computeBudgetSpent(h.db, h.userId, apr2026FromMs, apr2026ToMs);
		expect(map.has('cat1-other')).toBe(false);
	});

	it('transfer rows do not count', async () => {
		// add a second account so transfer is valid
		const now = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
			.run('acc-bank', h.userId, 'Bank', 'bank', 'IDR', 0, now, now);

		insertTx('t-tx', null, 'transfer', 99999, apr2026Mid, { transferTo: 'acc-bank' });

		const map = await computeBudgetSpent(h.db, h.userId, apr2026FromMs, apr2026ToMs);
		expect(map.size).toBe(0);
	});
});
