import { error, fail, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { uploadAvatar } from '$lib/server/storage/avatar';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	throw redirect(302, '/settings');
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const fd = await event.request.formData();
		const file = fd.get('avatar');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'No file uploaded' });
		}
		try {
			await uploadAvatar({ bucket: event.platform!.env.UPLOADS, userId: user.id, file });
		} catch (err) {
			return fail(400, { message: err instanceof Error ? err.message : 'Upload failed' });
		}
		try {
			await event.locals.auth.api.updateUser({
				body: { image: `/api/avatar/${user.id}?v=${Date.now()}` },
				headers: event.request.headers
			});
		} catch {
			error(500, 'Failed to update user profile');
		}
		throw redirect(303, '/settings');
	}
};
