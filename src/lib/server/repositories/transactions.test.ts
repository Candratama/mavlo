import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	listTransactions,
	createTransaction,
	updateTransaction,
	deleteTransaction,
	getTransaction
} from './transactions';
import { createDebt, getDebt } from './debts';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions', 'budgets', 'budget_subsidies', 'debts'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc2', h.otherUserId, 'Other Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc-other', h.otherUserId, 'Cash', 'cash', 'IDR', 0, now, now);
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
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

const baseDebt = () => ({
	name: 'CC',
	type: 'credit_card' as const,
	principalCents: 10_000_000,
	currentBalanceCents: 5_000_000,
	interestRatePct: 2600,
	minimumPaymentCents: 250_000,
	startDate: Date.UTC(2026, 0, 1)
});

const expenseInput = (overrides: Partial<{ amountCents: number; debtId?: string }> = {}) => ({
	accountId: 'acc1',
	amountCents: 500_000,
	kind: 'expense' as const,
	occurredAt: Date.UTC(2026, 4, 15),
	...overrides
});

describe('createTransaction debt hook', () => {
	it('decreases debt balance when expense is linked', async () => {
		const d = await createDebt(h.db, h.userId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		await createTransaction(h.db, h.userId, expenseInput({ debtId: d.id }));
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(4_500_000);
	});

	it('does not change debt when kind is not expense', async () => {
		const d = await createDebt(h.db, h.userId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		await createTransaction(h.db, h.userId, {
			...expenseInput({ debtId: d.id }),
			kind: 'income'
		});
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(5_000_000);
	});

	it('clamps at 0 and flips status to paid_off', async () => {
		const d = await createDebt(h.db, h.userId, { ...baseDebt(), currentBalanceCents: 100_000 });
		if ('error' in d) throw new Error(d.error);
		await createTransaction(h.db, h.userId, expenseInput({ amountCents: 500_000, debtId: d.id }));
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(0);
		expect(after?.status).toBe('paid_off');
	});

	it('does not change debt when debtId belongs to another user', async () => {
		const d = await createDebt(h.db, h.otherUserId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		await createTransaction(h.db, h.userId, expenseInput({ debtId: d.id }));
		const after = await getDebt(h.db, h.otherUserId, d.id);
		expect(after?.currentBalanceCents).toBe(5_000_000);
	});
});

describe('updateTransaction debt hook', () => {
	it('reverses old amount and applies new on amount change', async () => {
		const d = await createDebt(h.db, h.userId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		const tx = await createTransaction(h.db, h.userId, expenseInput({ debtId: d.id }));
		// Now balance = 4_500_000
		await updateTransaction(h.db, h.userId, {
			id: tx.id,
			accountId: 'acc1',
			amountCents: 1_000_000,
			kind: 'expense',
			occurredAt: tx.occurredAt,
			debtId: d.id
		});
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(4_000_000); // 5M - 1M
	});

	it('adding debt link decreases balance', async () => {
		const d = await createDebt(h.db, h.userId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		const tx = await createTransaction(h.db, h.userId, expenseInput());
		// No debt link yet, balance unchanged
		await updateTransaction(h.db, h.userId, {
			id: tx.id,
			accountId: 'acc1',
			amountCents: 500_000,
			kind: 'expense',
			occurredAt: tx.occurredAt,
			debtId: d.id
		});
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(4_500_000);
	});

	it('removing debt link restores balance', async () => {
		const d = await createDebt(h.db, h.userId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		const tx = await createTransaction(h.db, h.userId, expenseInput({ debtId: d.id }));
		// balance = 4_500_000
		await updateTransaction(h.db, h.userId, {
			id: tx.id,
			accountId: 'acc1',
			amountCents: 500_000,
			kind: 'expense',
			occurredAt: tx.occurredAt
			// no debtId
		});
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(5_000_000);
	});

	it('switching debt link reverses old + applies new', async () => {
		const d1 = await createDebt(h.db, h.userId, baseDebt());
		const d2 = await createDebt(h.db, h.userId, { ...baseDebt(), name: 'CC2' });
		if ('error' in d1 || 'error' in d2) throw new Error('setup failed');
		const tx = await createTransaction(h.db, h.userId, expenseInput({ debtId: d1.id }));
		// d1: 4_500_000, d2: 5_000_000
		await updateTransaction(h.db, h.userId, {
			id: tx.id,
			accountId: 'acc1',
			amountCents: 500_000,
			kind: 'expense',
			occurredAt: tx.occurredAt,
			debtId: d2.id
		});
		const a1 = await getDebt(h.db, h.userId, d1.id);
		const a2 = await getDebt(h.db, h.userId, d2.id);
		expect(a1?.currentBalanceCents).toBe(5_000_000);
		expect(a2?.currentBalanceCents).toBe(4_500_000);
	});

	it('restoring balance flips paid_off back to active', async () => {
		const d = await createDebt(h.db, h.userId, { ...baseDebt(), currentBalanceCents: 500_000 });
		if ('error' in d) throw new Error(d.error);
		const tx = await createTransaction(h.db, h.userId, expenseInput({ debtId: d.id }));
		// paid off now
		await updateTransaction(h.db, h.userId, {
			id: tx.id,
			accountId: 'acc1',
			amountCents: 100_000, // smaller payment
			kind: 'expense',
			occurredAt: tx.occurredAt,
			debtId: d.id
		});
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(400_000);
		expect(after?.status).toBe('active');
	});
});

describe('deleteTransaction debt hook', () => {
	it('restores debt balance', async () => {
		const d = await createDebt(h.db, h.userId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		const tx = await createTransaction(h.db, h.userId, expenseInput({ debtId: d.id }));
		await deleteTransaction(h.db, h.userId, tx.id);
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(5_000_000);
	});

	it('does nothing for tx without debtId', async () => {
		const d = await createDebt(h.db, h.userId, baseDebt());
		if ('error' in d) throw new Error(d.error);
		const tx = await createTransaction(h.db, h.userId, expenseInput());
		await deleteTransaction(h.db, h.userId, tx.id);
		const after = await getDebt(h.db, h.userId, d.id);
		expect(after?.currentBalanceCents).toBe(5_000_000);
	});
});
