import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';

export type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}
