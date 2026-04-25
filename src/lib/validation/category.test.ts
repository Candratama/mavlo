import { describe, it, expect } from 'vitest';
import { categoryCreateSchema, categoryUpdateSchema } from './category';

describe('category validation', () => {
	it('create requires name + kind', () => {
		expect(categoryCreateSchema.safeParse({ name: 'Food', kind: 'expense' }).success).toBe(true);
		expect(categoryCreateSchema.safeParse({ name: '', kind: 'expense' }).success).toBe(false);
		expect(categoryCreateSchema.safeParse({ name: 'Food', kind: 'savings' }).success).toBe(false);
	});

	it('create accepts optional color + icon', () => {
		const r = categoryCreateSchema.safeParse({
			name: 'Food',
			kind: 'expense',
			color: '#ff0000',
			icon: 'utensils'
		});
		expect(r.success).toBe(true);
	});

	it('update requires id', () => {
		expect(
			categoryUpdateSchema.safeParse({ id: 'abc', name: 'Food', kind: 'expense' }).success
		).toBe(true);
		expect(categoryUpdateSchema.safeParse({ name: 'Food', kind: 'expense' }).success).toBe(false);
	});
});
