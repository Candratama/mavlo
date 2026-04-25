import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { signUpSchema } from '$lib/validation/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) throw redirect(302, '/dashboard');
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const parsed = signUpSchema.safeParse({
			name: formData.get('name'),
			email: formData.get('email'),
			password: formData.get('password')
		});

		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Invalid input',
				email: formData.get('email')?.toString() ?? '',
				name: formData.get('name')?.toString() ?? ''
			});
		}

		try {
			await event.locals.auth.api.signUpEmail({ body: parsed.data });
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					message: err.message || 'Sign-up failed',
					email: parsed.data.email,
					name: parsed.data.name
				});
			}
			return fail(500, {
				message: 'Unexpected error',
				email: parsed.data.email,
				name: parsed.data.name
			});
		}

		throw redirect(302, '/verify-sent');
	}
};
