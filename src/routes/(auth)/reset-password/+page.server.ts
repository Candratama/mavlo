import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { resetPasswordSchema } from '$lib/validation/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const token = event.url.searchParams.get('token') ?? '';
	return { token };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const parsed = resetPasswordSchema.safeParse({
			token: formData.get('token'),
			password: formData.get('password')
		});

		if (!parsed.success) {
			return fail(400, {
				message: parsed.error.issues[0]?.message ?? 'Invalid input',
				token: formData.get('token')?.toString() ?? ''
			});
		}

		try {
			await event.locals.auth.api.resetPassword({
				body: { newPassword: parsed.data.password, token: parsed.data.token }
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					message: err.message || 'Reset failed — request a new link',
					token: parsed.data.token
				});
			}
			return fail(500, { message: 'Unexpected error', token: parsed.data.token });
		}

		throw redirect(302, '/sign-in?reset=ok');
	}
};
