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
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
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

	it('listTransactions does not return other-user rows', async () => {
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

	it('createTransaction persists transferToAccountId for transfers', async () => {
		const now = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
			.run('acc-bank', h.userId, 'Bank', 'bank', 'IDR', 0, now, now);

		const t = await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			transferToAccountId: 'acc-bank',
			amountCents: 5000,
			kind: 'transfer',
			occurredAt: Date.now()
		});
		expect(t.transferToAccountId).toBe('acc-bank');

		const fetched = await getTransaction(h.db, h.userId, t.id);
		expect(fetched?.transferToAccountId).toBe('acc-bank');
		expect(fetched?.kind).toBe('transfer');
	});

	it('updateTransaction can change transferToAccountId', async () => {
		const now = Date.now();
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
			.run('acc-bank', h.userId, 'Bank', 'bank', 'IDR', 0, now, now);
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
			.run('acc-wallet', h.userId, 'Wallet', 'wallet', 'IDR', 0, now, now);

		const t = await createTransaction(h.db, h.userId, {
			accountId: 'acc1',
			transferToAccountId: 'acc-bank',
			amountCents: 5000,
			kind: 'transfer',
			occurredAt: Date.now()
		});

		const updated = await updateTransaction(h.db, h.userId, {
			id: t.id,
			accountId: 'acc1',
			transferToAccountId: 'acc-wallet',
			amountCents: 5000,
			kind: 'transfer',
			occurredAt: Date.now()
		});
		expect(updated?.transferToAccountId).toBe('acc-wallet');
	});
});
