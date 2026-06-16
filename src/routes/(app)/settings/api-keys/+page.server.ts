import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { createApiKey, listApiKeys, revokeApiKey } from '$lib/server/repositories/api-keys';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);
	return { keys: await listApiKeys(db, user.id) };
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const name = String(fd.get('name') ?? '').trim();
		if (!name) return fail(400, { action: 'create', message: 'Name required' });
		const { plaintext } = await createApiKey(db, user.id, name);
		return { success: true, action: 'create', plaintext };
	},

	revoke: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const id = String(fd.get('id') ?? '');
		if (!id) return fail(400, { action: 'revoke', message: 'Id required' });
		const revoked = await revokeApiKey(db, user.id, id);
		if (!revoked) return fail(404, { action: 'revoke', message: 'Key not found' });
		return { success: true, action: 'revoke' };
	}
};
