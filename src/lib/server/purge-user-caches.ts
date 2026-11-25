import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { purgeUserCache, allUserCacheNames } from '$lib/server/cf-cache';
import { getPreferences } from '$lib/server/repositories/preferences';
import { getCurrentCycle } from '$lib/utils/cycle';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

/** Drop the user's cached dashboard aggregates after a write, so the app shows fresh numbers. */
export async function purgeUserCachesForCurrentCycle(db: Db, userId: string): Promise<void> {
	const prefs = await getPreferences(db, userId);
	const cycle = getCurrentCycle(
		new Date(),
		prefs?.monthStartDay ?? 1,
		prefs?.timezone ?? 'Asia/Jakarta'
	);
	await purgeUserCache(userId, allUserCacheNames(cycle.periodMonth, 6));
}
