import { z } from 'zod';

export const subsidyCreateSchema = z
	.object({
		fromBudgetId: z.string().min(1, 'Source budget required'),
		toBudgetId: z.string().min(1, 'Target budget required'),
		amountCents: z.coerce.number().int().positive('Amount must be positive'),
		note: z.string().max(200, 'Note too long').optional()
	})
	.refine((d) => d.fromBudgetId !== d.toBudgetId, {
		message: 'Source and target must differ',
		path: ['toBudgetId']
	});

export const subsidyUpdateSchema = z.object({
	id: z.string().min(1, 'Id required'),
	amountCents: z.coerce.number().int().positive('Amount must be positive'),
	note: z.string().max(200, 'Note too long').optional()
});

export const subsidyIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type SubsidyCreateInput = z.infer<typeof subsidyCreateSchema>;
export type SubsidyUpdateInput = z.infer<typeof subsidyUpdateSchema>;
