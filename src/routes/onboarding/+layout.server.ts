import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const [userRow] = await db
		.select({ onboardedAt: users.onboardedAt })
		.from(users)
		.where(eq(users.id, user.id))
		.limit(1);
	if (userRow?.onboardedAt) {
		throw redirect(302, '/dashboard');
	}

	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email
		}
	};
};
