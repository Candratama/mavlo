import { z } from 'zod';
import { accountTypeEnum } from './account';

export const onboardingCompleteSchema = z.object({
	currency: z.string().trim().min(1).max(8).default('IDR'),
	locale: z.string().trim().min(1).max(20).default('id-ID'),
	timezone: z.string().trim().min(1).max(60).default('Asia/Jakarta'),
	accountName: z.string().trim().min(1, 'Nama akun wajib diisi').max(80),
	accountType: accountTypeEnum,
	initialBalanceCents: z.coerce.number().int().min(0).default(0),
	categoryNames: z
		.string()
		.optional()
		.transform((s) => (s ? s.split(',').filter(Boolean) : []))
});

export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;
