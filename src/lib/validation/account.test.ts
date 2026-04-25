import { describe, it, expect } from 'vitest';
import { accountCreateSchema, accountUpdateSchema } from './account';

describe('account validation', () => {
	it('create requires name + valid type + currency', () => {
		expect(accountCreateSchema.safeParse({ name: 'Cash', type: 'cash', currency: 'IDR' }).success).toBe(true);
		expect(accountCreateSchema.safeParse({ name: '', type: 'cash', currency: 'IDR' }).success).toBe(false);
		expect(accountCreateSchema.safeParse({ name: 'X', type: 'invalid', currency: 'IDR' }).success).toBe(false);
		expect(accountCreateSchema.safeParse({ name: 'X', type: 'cash', currency: '' }).success).toBe(false);
	});

	it('create defaults initialBalanceCents to 0', () => {
		const r = accountCreateSchema.safeParse({ name: 'X', type: 'cash', currency: 'IDR' });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.initialBalanceCents).toBe(0);
	});

	it('create accepts negative initialBalanceCents (credit cards)', () => {
		const r = accountCreateSchema.safeParse({
			name: 'CC',
			type: 'credit',
			currency: 'IDR',
			initialBalanceCents: -50000
		});
		expect(r.success).toBe(true);
	});

	it('update requires id', () => {
		expect(
			accountUpdateSchema.safeParse({ id: 'abc', name: 'New', type: 'bank', currency: 'IDR' }).success
		).toBe(true);
		expect(
			accountUpdateSchema.safeParse({ name: 'New', type: 'bank', currency: 'IDR' }).success
		).toBe(false);
	});
});
