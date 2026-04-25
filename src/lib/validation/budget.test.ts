import { describe, it, expect } from 'vitest';
import { budgetCreateSchema, budgetUpdateSchema } from './budget';

describe('budget validation', () => {
	const valid = { categoryId: 'cat1', periodMonth: '2026-04', limitCents: 500000 };

	it('create requires categoryId, periodMonth (YYYY-MM), positive limitCents', () => {
		expect(budgetCreateSchema.safeParse(valid).success).toBe(true);
		expect(budgetCreateSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, periodMonth: '2026-4' }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, periodMonth: '2026/04' }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, limitCents: 0 }).success).toBe(false);
		expect(budgetCreateSchema.safeParse({ ...valid, limitCents: -100 }).success).toBe(false);
	});

	it('update requires id', () => {
		expect(budgetUpdateSchema.safeParse({ ...valid, id: 'b1' }).success).toBe(true);
		expect(budgetUpdateSchema.safeParse(valid).success).toBe(false);
	});
});
