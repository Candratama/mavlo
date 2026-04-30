import { z } from 'zod';

export const accountTypeEnum = z.enum(['cash', 'bank', 'credit', 'wallet', 'savings', 'other']);

export const SAVINGS_ACCOUNT_TYPE = 'savings' as const;

export const accountCreateSchema = z.object({
	name: z.string().trim().min(1, 'Name required').max(80),
	type: accountTypeEnum,
	currency: z.string().trim().min(1, 'Currency required').max(8).default('IDR'),
	initialBalanceCents: z.coerce.number().int().default(0),
	color: z
		.string()
		.trim()
		.regex(/^#[0-9a-fA-F]{6}$/, 'Color must be #RRGGBB')
		.optional()
		.or(z.literal('').transform(() => undefined)),
	icon: z
		.string()
		.trim()
		.max(60)
		.optional()
		.or(z.literal('').transform(() => undefined))
});

export const accountUpdateSchema = accountCreateSchema.extend({
	id: z.string().min(1, 'Id required')
});

export const accountIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
export type AccountType = z.infer<typeof accountTypeEnum>;
