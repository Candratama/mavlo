import { describe, expect, it } from 'vitest';
import { subsidyCreateSchema, subsidyUpdateSchema, subsidyIdSchema } from './subsidy';

describe('subsidyCreateSchema', () => {
	const valid = {
		fromBudgetId: 'b1',
		toBudgetId: 'b2',
		amountCents: 1000
	};

	it('accepts valid input', () => {
		expect(subsidyCreateSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts optional note', () => {
		expect(subsidyCreateSchema.safeParse({ ...valid, note: 'hello' }).success).toBe(true);
	});

	it('rejects fromBudgetId === toBudgetId', () => {
		const result = subsidyCreateSchema.safeParse({
			...valid,
			toBudgetId: valid.fromBudgetId
		});
		expect(result.success).toBe(false);
	});

	it('rejects amountCents <= 0', () => {
		expect(subsidyCreateSchema.safeParse({ ...valid, amountCents: 0 }).success).toBe(false);
		expect(subsidyCreateSchema.safeParse({ ...valid, amountCents: -1 }).success).toBe(false);
	});

	it('rejects non-integer amountCents', () => {
		expect(subsidyCreateSchema.safeParse({ ...valid, amountCents: 10.5 }).success).toBe(false);
	});

	it('rejects note > 200 chars', () => {
		expect(subsidyCreateSchema.safeParse({ ...valid, note: 'x'.repeat(201) }).success).toBe(false);
	});

	it('coerces string amountCents to number', () => {
		const parsed = subsidyCreateSchema.parse({ ...valid, amountCents: '500' });
		expect(parsed.amountCents).toBe(500);
	});
});

describe('subsidyUpdateSchema', () => {
	it('requires id', () => {
		expect(subsidyUpdateSchema.safeParse({ amountCents: 100 }).success).toBe(false);
	});

	it('accepts id + amountCents', () => {
		expect(subsidyUpdateSchema.safeParse({ id: 's1', amountCents: 100 }).success).toBe(true);
	});

	it('accepts optional note', () => {
		expect(subsidyUpdateSchema.safeParse({ id: 's1', amountCents: 100, note: 'x' }).success).toBe(
			true
		);
	});
});

describe('subsidyIdSchema', () => {
	it('requires non-empty id', () => {
		expect(subsidyIdSchema.safeParse({ id: '' }).success).toBe(false);
		expect(subsidyIdSchema.safeParse({ id: 'x' }).success).toBe(true);
	});
});
