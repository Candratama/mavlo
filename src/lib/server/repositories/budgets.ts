import { and, asc, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { budgets } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { BudgetCreateInput, BudgetUpdateInput } from '$lib/validation/budget';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function listBudgets(db: Db, userId: string, filter: { periodMonth?: string }) {
	const conds = [eq(budgets.userId, userId)];
	if (filter.periodMonth) conds.push(eq(budgets.periodMonth, filter.periodMonth));
	return db
		.select()
		.from(budgets)
		.where(and(...conds))
		.orderBy(asc(budgets.categoryId));
}

export async function getBudget(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(budgets)
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
		.limit(1);
	return row ?? null;
}

export async function createBudget(db: Db, userId: string, input: BudgetCreateInput) {
	const [row] = await db
		.insert(budgets)
		.values({
			userId,
			categoryId: input.categoryId,
			periodMonth: input.periodMonth,
			limitCents: input.limitCents
		})
		.returning();
	return row;
}

export async function updateBudget(db: Db, userId: string, input: BudgetUpdateInput) {
	const [row] = await db
		.update(budgets)
		.set({
			categoryId: input.categoryId,
			periodMonth: input.periodMonth,
			limitCents: input.limitCents,
			updatedAt: Date.now()
		})
		.where(and(eq(budgets.userId, userId), eq(budgets.id, input.id)))
		.returning();
	return row ?? null;
}

export async function deleteBudget(db: Db, userId: string, id: string) {
	const [row] = await db
		.delete(budgets)
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
		.returning();
	return row ?? null;
}
