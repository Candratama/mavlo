import { and, asc, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { categories } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { CategoryCreateInput, CategoryUpdateInput } from '$lib/validation/category';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function listCategories(
	db: Db,
	userId: string,
	opts: { includeArchived: boolean }
) {
	const where = opts.includeArchived
		? eq(categories.userId, userId)
		: and(eq(categories.userId, userId), eq(categories.archived, false));
	return db.select().from(categories).where(where).orderBy(asc(categories.kind), asc(categories.name));
}

export async function getCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(categories)
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.limit(1);
	return row ?? null;
}

export async function createCategory(db: Db, userId: string, input: CategoryCreateInput) {
	const [row] = await db
		.insert(categories)
		.values({
			userId,
			name: input.name,
			kind: input.kind,
			color: input.color ?? null,
			icon: input.icon ?? null
		})
		.returning();
	return row;
}

export async function updateCategory(db: Db, userId: string, input: CategoryUpdateInput) {
	const [row] = await db
		.update(categories)
		.set({
			name: input.name,
			kind: input.kind,
			color: input.color ?? null,
			icon: input.icon ?? null,
			updatedAt: Date.now()
		})
		.where(and(eq(categories.userId, userId), eq(categories.id, input.id)))
		.returning();
	return row ?? null;
}

export async function archiveCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(categories)
		.set({ archived: true, updatedAt: Date.now() })
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.returning();
	return row ?? null;
}

export async function unarchiveCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(categories)
		.set({ archived: false, updatedAt: Date.now() })
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.returning();
	return row ?? null;
}
