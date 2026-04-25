import { z } from 'zod';

export const transactionKindEnum = z.enum(['income', 'expense']);

const emptyToUndefined = z.literal('').transform(() => undefined);

export const transactionCreateSchema = z.object({
	accountId: z.string().min(1, 'Account required'),
	categoryId: z.string().min(1).optional().or(emptyToUndefined),
	amountCents: z.coerce.number().int().positive('Amount must be positive'),
	kind: transactionKindEnum,
	note: z.string().trim().max(200).optional().or(emptyToUndefined),
	occurredAt: z.coerce.number().int().positive('Date required')
});

export const transactionUpdateSchema = transactionCreateSchema.extend({
	id: z.string().min(1, 'Id required')
});

export const transactionIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export const transactionListFilterSchema = z.object({
	fromMs: z.coerce.number().int().optional(),
	toMs: z.coerce.number().int().optional(),
	accountId: z.string().min(1).optional().or(emptyToUndefined),
	categoryId: z.string().min(1).optional().or(emptyToUndefined),
	kind: transactionKindEnum.optional()
});

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListFilter = z.infer<typeof transactionListFilterSchema>;
export type TransactionKind = z.infer<typeof transactionKindEnum>;
