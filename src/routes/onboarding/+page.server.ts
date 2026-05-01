import { fail, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { completeOnboarding } from '$lib/server/repositories/onboarding';
import { onboardingCompleteSchema } from '$lib/validation/onboarding';
import { DEFAULT_CATEGORIES } from '$lib/server/onboarding-defaults';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { defaultCategories: DEFAULT_CATEGORIES };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = onboardingCompleteSchema.safeParse(Object.fromEntries(fd.entries()));
		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Invalid data'
			});
		}

		try {
			await completeOnboarding(db, user.id, parsed.data);
		} catch (err) {
			console.error('completeOnboarding failed', err);
			return fail(500, { message: 'Could not save setup. Please try again.' });
		}

		throw redirect(302, '/dashboard');
	}
};
