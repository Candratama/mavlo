import { z } from 'zod';

export const categoryKindEnum = z.enum(['income', 'expense']);

export const categoryCreateSchema = z.object({
	name: z.string().trim().min(1, 'Name required').max(60),
	kind: categoryKindEnum,
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

export const categoryUpdateSchema = categoryCreateSchema.extend({
	id: z.string().min(1, 'Id required')
});

export const categoryIdSchema = z.object({
	id: z.string().min(1, 'Id required')
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryKind = z.infer<typeof categoryKindEnum>;
