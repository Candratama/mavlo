import { and, asc, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { accounts } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { AccountCreateInput, AccountUpdateInput } from '$lib/validation/account';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function listAccounts(
	db: Db,
	userId: string,
	opts: { includeArchived: boolean }
) {
	const where = opts.includeArchived
		? eq(accounts.userId, userId)
		: and(eq(accounts.userId, userId), eq(accounts.archived, false));
	return db.select().from(accounts).where(where).orderBy(asc(accounts.name));
}

export async function getAccount(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
		.limit(1);
	return row ?? null;
}

export async function createAccount(db: Db, userId: string, input: AccountCreateInput) {
	const [row] = await db
		.insert(accounts)
		.values({
			userId,
			name: input.name,
			type: input.type,
			currency: input.currency,
			initialBalanceCents: input.initialBalanceCents,
			color: input.color ?? null,
			icon: input.icon ?? null
		})
		.returning();
	return row;
}

export async function updateAccount(db: Db, userId: string, input: AccountUpdateInput) {
	const [row] = await db
		.update(accounts)
		.set({
			name: input.name,
			type: input.type,
			currency: input.currency,
			initialBalanceCents: input.initialBalanceCents,
			color: input.color ?? null,
			icon: input.icon ?? null,
			updatedAt: Date.now()
		})
		.where(and(eq(accounts.userId, userId), eq(accounts.id, input.id)))
		.returning();
	return row ?? null;
}

export async function archiveAccount(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(accounts)
		.set({ archived: true, updatedAt: Date.now() })
		.where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
		.returning();
	return row ?? null;
}

export async function unarchiveAccount(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(accounts)
		.set({ archived: false, updatedAt: Date.now() })
		.where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
		.returning();
	return row ?? null;
}
