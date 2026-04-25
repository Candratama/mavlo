import { fail } from '@sveltejs/kit';
import { forgotPasswordSchema } from '$lib/validation/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Invalid email',
				email: formData.get('email')?.toString() ?? ''
			});
		}

		// Better Auth handles enumeration safety; we always claim success regardless of outcome.
		try {
			await event.locals.auth.api.requestPasswordReset({
				body: {
					email: parsed.data.email,
					redirectTo: '/reset-password'
				}
			});
		} catch {
			// swallow — never reveal whether email exists
		}

		return { sent: true };
	}
};
