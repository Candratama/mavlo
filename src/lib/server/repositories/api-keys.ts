import { and, desc, eq, isNull } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { apiKeys } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import { generateApiKey, hashApiKey } from '$lib/server/api/keys-crypto';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

const publicColumns = {
	id: apiKeys.id,
	name: apiKeys.name,
	prefix: apiKeys.prefix,
	lastUsedAt: apiKeys.lastUsedAt,
	createdAt: apiKeys.createdAt,
	revokedAt: apiKeys.revokedAt
};

export async function createApiKey(db: Db, userId: string, name: string) {
	const { plaintext, prefix } = generateApiKey();
	const keyHash = await hashApiKey(plaintext);
	const [row] = await db.insert(apiKeys).values({ userId, name, keyHash, prefix }).returning();
	return { row, plaintext };
}

export async function listApiKeys(db: Db, userId: string) {
	return db
		.select(publicColumns)
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))
		.orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(apiKeys)
		.set({ revokedAt: Date.now() })
		.where(and(eq(apiKeys.userId, userId), eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
		.returning();
	return row ?? null;
}

export async function authenticateApiKey(db: Db, plaintext: string): Promise<string | null> {
	const keyHash = await hashApiKey(plaintext);
	const [row] = await db
		.update(apiKeys)
		.set({ lastUsedAt: Date.now() })
		.where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
		.returning({ userId: apiKeys.userId });
	return row?.userId ?? null;
}
