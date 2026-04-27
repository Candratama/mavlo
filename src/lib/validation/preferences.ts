import { z } from 'zod';

export const preferencesUpdateSchema = z.object({
	currency: z.string().trim().min(1, 'Currency required').max(8),
	locale: z.string().trim().min(1, 'Locale required').max(20),
	timezone: z.string().trim().min(1, 'Timezone required').max(60),
	theme: z.enum(['light', 'dark', 'system']),
	weekStartsOn: z.coerce.number().int().min(0).max(6),
	monthStartDay: z.coerce.number().int().min(1).max(31)
});

export type PreferencesUpdateInput = z.infer<typeof preferencesUpdateSchema>;
