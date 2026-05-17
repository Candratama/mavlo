import { describe, expect, it } from 'vitest';
import { debtCreateSchema, debtUpdateSchema, debtIdSchema } from './debt';

const valid = {
	name: 'Credit Card BCA',
	type: 'credit_card' as const,
	principalCents: 10_000_000,
	currentBalanceCents: 4_500_000,
	interestRatePct: 2600,
	minimumPaymentCents: 250_000,
	startDate: Date.UTC(2026, 0, 1)
};

describe('debtCreateSchema', () => {
	it('accepts valid input', () => {
		expect(debtCreateSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects empty name', () => {
		expect(debtCreateSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
	});

	it('rejects name > 100 chars', () => {
		expect(debtCreateSchema.safeParse({ ...valid, name: 'x'.repeat(101) }).success).toBe(false);
	});

	it('rejects unknown type', () => {
		expect(debtCreateSchema.safeParse({ ...valid, type: 'unknown' }).success).toBe(false);
	});

	it('rejects non-positive principal', () => {
		expect(debtCreateSchema.safeParse({ ...valid, principalCents: 0 }).success).toBe(false);
		expect(debtCreateSchema.safeParse({ ...valid, principalCents: -1 }).success).toBe(false);
	});

	it('rejects negative currentBalance', () => {
		expect(debtCreateSchema.safeParse({ ...valid, currentBalanceCents: -1 }).success).toBe(false);
	});

	it('accepts currentBalance = 0', () => {
		expect(debtCreateSchema.safeParse({ ...valid, currentBalanceCents: 0 }).success).toBe(true);
	});

	it('rejects interestRatePct out of range', () => {
		expect(debtCreateSchema.safeParse({ ...valid, interestRatePct: -1 }).success).toBe(false);
		expect(debtCreateSchema.safeParse({ ...valid, interestRatePct: 10001 }).success).toBe(false);
	});

	it('rejects negative minimumPayment', () => {
		expect(debtCreateSchema.safeParse({ ...valid, minimumPaymentCents: -1 }).success).toBe(false);
	});

	it('rejects dueDay out of range', () => {
		expect(debtCreateSchema.safeParse({ ...valid, dueDay: 0 }).success).toBe(false);
		expect(debtCreateSchema.safeParse({ ...valid, dueDay: 32 }).success).toBe(false);
	});

	it('accepts dueDay in range', () => {
		expect(debtCreateSchema.safeParse({ ...valid, dueDay: 15 }).success).toBe(true);
	});

	it('rejects maturityDate <= startDate', () => {
		expect(
			debtCreateSchema.safeParse({ ...valid, maturityDate: valid.startDate - 1 }).success
		).toBe(false);
		expect(
			debtCreateSchema.safeParse({ ...valid, maturityDate: valid.startDate }).success
		).toBe(false);
	});

	it('accepts maturityDate > startDate', () => {
		expect(
			debtCreateSchema.safeParse({ ...valid, maturityDate: valid.startDate + 86_400_000 }).success
		).toBe(true);
	});

	it('rejects note > 200 chars', () => {
		expect(debtCreateSchema.safeParse({ ...valid, note: 'x'.repeat(201) }).success).toBe(false);
	});

	it('coerces numeric fields from strings (form data)', () => {
		const result = debtCreateSchema.safeParse({
			...valid,
			principalCents: '10000000',
			interestRatePct: '2600'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.principalCents).toBe(10_000_000);
			expect(result.data.interestRatePct).toBe(2600);
		}
	});
});

describe('debtUpdateSchema', () => {
	it('requires id', () => {
		expect(debtUpdateSchema.safeParse(valid).success).toBe(false);
	});

	it('accepts id + valid fields', () => {
		expect(debtUpdateSchema.safeParse({ ...valid, id: 'd1' }).success).toBe(true);
	});

	it('accepts optional status', () => {
		expect(
			debtUpdateSchema.safeParse({ ...valid, id: 'd1', status: 'paid_off' }).success
		).toBe(true);
	});

	it('rejects unknown status', () => {
		expect(
			debtUpdateSchema.safeParse({ ...valid, id: 'd1', status: 'invalid' }).success
		).toBe(false);
	});
});

describe('debtIdSchema', () => {
	it('requires non-empty id', () => {
		expect(debtIdSchema.safeParse({ id: '' }).success).toBe(false);
		expect(debtIdSchema.safeParse({ id: 'x' }).success).toBe(true);
	});
});
