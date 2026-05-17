import { z } from 'zod';

export const transactionKindEnum = z.enum(['income', 'expense', 'transfer']);

const emptyToUndefined = z.literal('').transform(() => undefined);

const baseTransactionFields = {
	accountId: z.string().min(1, 'Account required'),
	categoryId: z.string().min(1).optional().or(emptyToUndefined),
	transferToAccountId: z.string().min(1).optional().or(emptyToUndefined),
	debtId: z.string().min(1).optional(),
	amountCents: z.coerce.number().int().positive('Amount must be positive'),
	kind: transactionKindEnum,
	note: z.string().trim().max(200).optional().or(emptyToUndefined),
	occurredAt: z.coerce.number().int().positive('Date required')
};

const refineTransfer = <
	T extends { kind: string; accountId: string; transferToAccountId?: string }
>(
	val: T,
	ctx: z.RefinementCtx
) => {
	if (val.kind === 'transfer') {
		if (!val.transferToAccountId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['transferToAccountId'],
				message: 'Destination account required for transfer'
			});
			return;
		}
		if (val.transferToAccountId === val.accountId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['transferToAccountId'],
				message: 'Source and destination must differ'
			});
		}
	}
};

const stripTransferTarget = <T extends { kind: string; transferToAccountId?: string }>(
	val: T
): T => {
	if (val.kind !== 'transfer') {
		return { ...val, transferToAccountId: undefined };
	}
	return val;
};

export const transactionCreateSchema = z
	.object(baseTransactionFields)
	.superRefine(refineTransfer)
	.transform(stripTransferTarget);

export const transactionUpdateSchema = z
	.object({ ...baseTransactionFields, id: z.string().min(1, 'Id required') })
	.superRefine(refineTransfer)
	.transform(stripTransferTarget);

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
