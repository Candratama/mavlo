import { and, desc, eq, isNull } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { apiKeys, users } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import { generateApiKey, hashApiKey } from '$lib/server/api/keys-crypto';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

type ApiKeyRow = typeof apiKeys.$inferSelect;

function toPublicKey(row: ApiKeyRow) {
	return {
		id: row.id,
		name: row.name,
		prefix: row.prefix,
		lastUsedAt: row.lastUsedAt,
		createdAt: row.createdAt,
		revokedAt: row.revokedAt
	};
}

export async function createApiKey(db: Db, userId: string, name: string) {
	const { plaintext, prefix } = generateApiKey();
	const keyHash = await hashApiKey(plaintext);
	const [row] = await db.insert(apiKeys).values({ userId, name, keyHash, prefix }).returning();
	return { key: toPublicKey(row), plaintext };
}

export async function listApiKeys(db: Db, userId: string) {
	const rows = await db
		.select()
		.from(apiKeys)
		.where(eq(apiKeys.userId, userId))
		.orderBy(desc(apiKeys.createdAt));
	return rows.map(toPublicKey);
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
		.returning();
	if (!row) return null;
	const [user] = await db.select().from(users).where(eq(users.id, row.userId));
	if (!user || user.isDemo) return null;
	return row.userId;
}
