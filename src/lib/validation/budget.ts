import { z } from 'zod';

const periodMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const budgetCreateSchema = z.object({
	categoryId: z.string().min(1, 'Category required'),
	periodMonth: z.string().regex(periodMonthRegex, 'Period must be YYYY-MM'),
	limitCents: z.coerce.number().int().positive('Limit must be positive')
});

// PATCH is a partial update: every body field is optional, only `id` is required.
export const budgetUpdateSchema = budgetCreateSchema.partial().extend({
	id: z.string().min(1, 'Id required')
});

export const budgetIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
