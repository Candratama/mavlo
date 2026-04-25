import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { updatePreferences } from '$lib/server/repositories/preferences';
import { preferencesUpdateSchema } from '$lib/validation/preferences';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Preferences come from (app)/+layout.server.ts via parent data.
	return {};
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

export const actions: Actions = {
	default: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = preferencesUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}
		await updatePreferences(db, user.id, parsed.data);
		return { success: true };
	}
};
