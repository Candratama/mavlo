import { z } from 'zod';

const periodMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const budgetCreateSchema = z.object({
	categoryId: z.string().min(1, 'Category required'),
	periodMonth: z.string().regex(periodMonthRegex, 'Period must be YYYY-MM'),
	limitCents: z.coerce.number().int().positive('Limit must be positive')
});

export const budgetUpdateSchema = budgetCreateSchema.extend({
	id: z.string().min(1, 'Id required')
});

export const budgetIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
