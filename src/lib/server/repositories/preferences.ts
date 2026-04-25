import { eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { userPreferences } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { PreferencesUpdateInput } from '$lib/validation/preferences';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function getPreferences(db: Db, userId: string) {
	const [row] = await db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);
	return row ?? null;
}

export async function updatePreferences(
	db: Db,
	userId: string,
	input: PreferencesUpdateInput
) {
	const [row] = await db
		.update(userPreferences)
		.set({
			currency: input.currency,
			locale: input.locale,
			timezone: input.timezone,
			theme: input.theme,
			weekStartsOn: input.weekStartsOn,
			updatedAt: Date.now()
		})
		.where(eq(userPreferences.userId, userId))
		.returning();
	return row ?? null;
}
