import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { applyTransactionRules } from './transaction-rules';
import { createTransaction } from './transactions';
import { createDebt } from './debts';
import type { TransactionCreateInput } from '$lib/validation/transaction';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts', 'categories', 'transactions', 'debts'] });
	const now = Date.now();
	const acc = h.sqlite.prepare(
		'INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)'
	);
	acc.run('cash', h.userId, 'Cash', 'cash', 'IDR', 10_000, now, now);
	acc.run('save', h.userId, 'Savings', 'savings', 'IDR', 50_000, now, now);
	acc.run('theirs', h.otherUserId, 'Theirs', 'cash', 'IDR', 99_999, now, now);
});

const tx = (over: Partial<TransactionCreateInput> = {}): TransactionCreateInput => ({
	accountId: 'cash',
	amountCents: 1000,
	kind: 'expense',
	occurredAt: 1_700_000_000_000,
	...over
});

describe('applyTransactionRules', () => {
	it("rejects a source account that isn't the user's", async () => {
		await expect(
			applyTransactionRules(h.db, h.userId, tx({ accountId: 'theirs' }))
		).rejects.toThrow('Source account not found');
	});

	it('rejects income or expense on a savings account but allows a transfer out of it', async () => {
		await expect(applyTransactionRules(h.db, h.userId, tx({ accountId: 'save' }))).rejects.toThrow(
			'Savings accounts only support transfers'
		);
		await expect(
			applyTransactionRules(h.db, h.userId, tx({ accountId: 'save', kind: 'income' }))
		).rejects.toThrow('Savings accounts only support transfers');
		await expect(
			applyTransactionRules(
				h.db,
				h.userId,
				tx({ accountId: 'save', kind: 'transfer', transferToAccountId: 'cash' })
			)
		).resolves.toMatchObject({ kind: 'transfer' });
	});

	it('rejects spending more than the source balance', async () => {
		await expect(
			applyTransactionRules(h.db, h.userId, tx({ amountCents: 10_001 }))
		).rejects.toThrow('Insufficient balance in source account');
		await expect(
			applyTransactionRules(h.db, h.userId, tx({ amountCents: 10_000 }))
		).resolves.toBeTruthy();
	});

	it('does not balance-check income', async () => {
		await expect(
			applyTransactionRules(h.db, h.userId, tx({ kind: 'income', amountCents: 1_000_000 }))
		).resolves.toBeTruthy();
	});

	it("credits the edited transaction's old amount back when checking an update", async () => {
		const existing = await createTransaction(h.db, h.userId, tx({ amountCents: 8_000 }));
		// Balance is now 2_000; raising this expense to 10_000 fits once the old 8_000 is credited back.
		await expect(
			applyTransactionRules(h.db, h.userId, tx({ amountCents: 10_000 }), existing.id)
		).resolves.toBeTruthy();
		await expect(
			applyTransactionRules(h.db, h.userId, tx({ amountCents: 10_001 }), existing.id)
		).rejects.toThrow('Insufficient balance');
	});

	it('assigns the debt-payment category to an uncategorised repayment', async () => {
		const debt = await createDebt(h.db, h.userId, {
			name: 'Loan',
			type: 'kta',
			principalCents: 100_000,
			currentBalanceCents: 100_000,
			interestRatePct: 0,
			minimumPaymentCents: 0,
			startDate: 1_700_000_000_000,
			direction: 'borrowed'
		});
		if ('error' in debt) throw new Error(debt.error);
		const out = await applyTransactionRules(h.db, h.userId, tx({ debtId: debt.id }));
		expect(out.categoryId).toBeTruthy();
		const keep = await applyTransactionRules(
			h.db,
			h.userId,
			tx({ debtId: debt.id, categoryId: 'mine' })
		);
		expect(keep.categoryId).toBe('mine');
	});
});
