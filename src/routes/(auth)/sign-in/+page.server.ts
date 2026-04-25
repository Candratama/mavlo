import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { signInSchema } from '$lib/validation/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) throw redirect(302, '/dashboard');
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const parsed = signInSchema.safeParse({
			email: formData.get('email'),
			password: formData.get('password')
		});

		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Invalid input',
				email: formData.get('email')?.toString() ?? ''
			});
		}

		try {
			await event.locals.auth.api.signInEmail({ body: parsed.data });
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					message: err.message || 'Invalid email or password',
					email: parsed.data.email
				});
			}
			return fail(500, { message: 'Unexpected error', email: parsed.data.email });
		}

		throw redirect(302, '/dashboard');
	}
};
