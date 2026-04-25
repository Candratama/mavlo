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

	it('create coerces empty categoryId to undefined', () => {
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
