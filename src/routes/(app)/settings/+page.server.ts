import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/auth.schema';
import { updatePreferences } from '$lib/server/repositories/preferences';
import { preferencesUpdateSchema } from '$lib/validation/preferences';
import type { Actions } from './$types';

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

const USERNAME_RE = /^[A-Za-z0-9._]{3,30}$/;

export const actions: Actions = {
	prefs: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = preferencesUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}
		await updatePreferences(db, user.id, parsed.data);
		return { success: true };
	},
	username: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const raw = String(fd.get('username') ?? '').trim();
		if (!USERNAME_RE.test(raw)) {
			return fail(400, {
				usernameError: 'Username 3-30 chars, letters/numbers/dot/underscore only.'
			});
		}
		const existing = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.username, raw))
			.limit(1);
		if (existing[0] && existing[0].id !== user.id) {
			return fail(409, { usernameError: 'Username already taken.' });
		}
		await db.update(users).set({ username: raw }).where(eq(users.id, user.id));
		return { usernameSuccess: true };
	}
};
