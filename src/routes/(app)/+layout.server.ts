import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { userPreferences } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	let prefs = (
		await db
			.select()
			.from(userPreferences)
			.where(eq(userPreferences.userId, user.id))
			.limit(1)
	)[0];

	if (!prefs) {
		prefs = (
			await db
				.insert(userPreferences)
				.values({ userId: user.id })
				.returning()
		)[0];
	}

	return {
		user: { id: user.id, name: user.name, email: user.email, image: user.image },
		preferences: prefs
	};
};
