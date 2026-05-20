import { z } from 'zod';

const debtTypeEnum = z.enum([
	'credit_card',
	'kta',
	'kpr',
	'auto',
	'bnpl',
	'pinjol',
	'informal',
	'other'
]);

const debtStatusEnum = z.enum(['active', 'paid_off', 'in_arrears']);
const debtDirectionEnum = z.enum(['borrowed', 'lent']);

export const debtCreateSchema = z
	.object({
		name: z.string().min(1, 'Name required').max(100, 'Name too long'),
		type: debtTypeEnum,
		lender: z.string().max(100, 'Lender too long').optional(),
		principalCents: z.coerce.number().int().positive('Principal must be positive'),
		currentBalanceCents: z.coerce.number().int().nonnegative('Balance cannot be negative'),
		interestRatePct: z.coerce.number().int().min(0).max(10000, 'APR too high'),
		minimumPaymentCents: z.coerce.number().int().nonnegative('Min payment cannot be negative'),
		dueDay: z.coerce.number().int().min(1).max(31).optional(),
		startDate: z.coerce.number().int(),
		maturityDate: z.coerce.number().int().optional(),
		accountId: z.string().min(1).optional(),
		direction: debtDirectionEnum.optional(),
		note: z.string().max(200, 'Note too long').optional()
	})
	.refine((d) => d.maturityDate == null || d.maturityDate > d.startDate, {
		message: 'Maturity date must be after start date',
		path: ['maturityDate']
	});

export const debtUpdateSchema = debtCreateSchema.extend({
	id: z.string().min(1, 'Id required'),
	status: debtStatusEnum.optional()
});

export const debtIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type DebtCreateInput = z.infer<typeof debtCreateSchema>;
export type DebtUpdateInput = z.infer<typeof debtUpdateSchema>;
