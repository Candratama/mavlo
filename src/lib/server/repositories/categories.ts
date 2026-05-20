import { and, asc, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { categories } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { CategoryCreateInput, CategoryUpdateInput } from '$lib/validation/category';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function listCategories(db: Db, userId: string, opts: { includeArchived: boolean }) {
	const where = opts.includeArchived
		? eq(categories.userId, userId)
		: and(eq(categories.userId, userId), eq(categories.archived, false));
	return db
		.select()
		.from(categories)
		.where(where)
		.orderBy(asc(categories.sortOrder), asc(categories.name));
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

export async function deleteCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.delete(categories)
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.returning();
	return row ?? null;
}

export async function reorderCategories(
	db: Db,
	userId: string,
	orderedIds: string[]
): Promise<void> {
	await Promise.all(
		orderedIds.map((id, idx) =>
			db
				.update(categories)
				.set({ sortOrder: idx, updatedAt: Date.now() })
				.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		)
	);
}

const DEBT_PAYMENT_CATEGORY_NAME = 'Debt Payment';

export async function ensureDebtPaymentCategory(db: Db, userId: string): Promise<string> {
	const [existing] = await db
		.select()
		.from(categories)
		.where(and(eq(categories.userId, userId), eq(categories.name, DEBT_PAYMENT_CATEGORY_NAME)))
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(categories)
		.values({
			userId,
			name: DEBT_PAYMENT_CATEGORY_NAME,
			kind: 'expense',
			icon: 'wallet'
		})
		.returning();
	return created.id;
}

const LOAN_PROCEEDS_CATEGORY_NAME = 'Loan Proceeds';

export async function ensureLoanProceedsCategory(db: Db, userId: string): Promise<string> {
	const [existing] = await db
		.select()
		.from(categories)
		.where(
			and(
				eq(categories.userId, userId),
				eq(categories.name, LOAN_PROCEEDS_CATEGORY_NAME),
				eq(categories.kind, 'income')
			)
		)
		.limit(1);
	if (existing) return existing.id;
	const [created] = await db
		.insert(categories)
		.values({
			userId,
			name: LOAN_PROCEEDS_CATEGORY_NAME,
			kind: 'income',
			icon: 'banknote',
			color: '#10b981'
		})
		.returning();
	return created.id;
}

const ADJUSTMENT_NAME = 'Balance Adjustment';

export async function getOrCreateAdjustmentCategory(
	db: Db,
	userId: string,
	kind: 'income' | 'expense'
): Promise<string> {
	const [existing] = await db
		.select()
		.from(categories)
		.where(
			and(
				eq(categories.userId, userId),
				eq(categories.name, ADJUSTMENT_NAME),
				eq(categories.kind, kind)
			)
		)
		.limit(1);
	if (existing) return existing.id;

	const [created] = await db
		.insert(categories)
		.values({
			userId,
			name: ADJUSTMENT_NAME,
			kind,
			color: kind === 'income' ? '#10b981' : '#f43f5e',
			icon: kind === 'income' ? 'trending-up' : 'trending-down'
		})
		.returning();
	return created.id;
}
