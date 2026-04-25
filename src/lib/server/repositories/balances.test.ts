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

const insertTx = (
	h: TestDbHandle,
	args: { id: string; accountId: string; amount: number; kind: 'income' | 'expense' }
) => {
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)')
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
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
			.run('acc-other', h.otherUserId, 'Other', 'cash', 'IDR', 0, now, now);
		h.sqlite
			.prepare('INSERT INTO transactions VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)')
			.run('tother', h.otherUserId, 'acc-other', 99999, 'expense', now, now, now);

		const map = await computeAccountBalances(h.db, h.userId);
		expect(map.get('acc1')).toBe(100000);
		expect(map.get('acc2')).toBe(500000);
		expect(map.has('acc-other')).toBe(false);
	});
});
