import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { authenticateApiKey } from '$lib/server/repositories/api-keys';
import { ApiError } from './errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function requireApiKey(request: Request, db: Db): Promise<string> {
	const header = request.headers.get('authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) throw new ApiError(401, 'unauthorized', 'Missing or malformed bearer token');
	const userId = await authenticateApiKey(db, match[1].trim());
	if (!userId) throw new ApiError(401, 'unauthorized', 'Invalid or revoked API key');
	return userId;
}
