import { and, asc, eq, ne } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { budgets, categories } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { BudgetCreateInput, BudgetUpdateInput } from '$lib/validation/budget';
import { RepoValidationError } from './errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

/**
 * A budget may only point at one of the user's own expense categories, and a
 * user gets at most one budget per (category, period). `excludeId` skips the
 * budget being updated; `checkDuplicate: false` skips the duplicate lookup.
 * Throws RepoValidationError.
 */
async function assertBudgetTarget(
	db: Db,
	userId: string,
	categoryId: string,
	periodMonth: string,
	{ excludeId, checkDuplicate = true }: { excludeId?: string; checkDuplicate?: boolean } = {}
): Promise<void> {
	const [cat] = await db
		.select()
		.from(categories)
		.where(and(eq(categories.userId, userId), eq(categories.id, categoryId)))
		.limit(1);
	if (!cat) throw new RepoValidationError('Category not found');
	if (cat.kind !== 'expense') throw new RepoValidationError('Budgets require an expense category');
	if (!checkDuplicate) return;

	const dupConds = [
		eq(budgets.userId, userId),
		eq(budgets.categoryId, categoryId),
		eq(budgets.periodMonth, periodMonth)
	];
	if (excludeId) dupConds.push(ne(budgets.id, excludeId));
	const [dup] = await db
		.select()
		.from(budgets)
		.where(and(...dupConds))
		.limit(1);
	if (dup) {
		throw new RepoValidationError('A budget for this category and period already exists', true);
	}
}

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
	await assertBudgetTarget(db, userId, input.categoryId, input.periodMonth);
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

/** Returns null when the budget doesn't exist (or isn't the user's). */
export async function updateBudget(db: Db, userId: string, input: BudgetUpdateInput) {
	const existing = await getBudget(db, userId, input.id);
	if (!existing) return null;
	// Only a move to another category/period can create a duplicate. Skipping the
	// check otherwise keeps pre-existing duplicate rows editable.
	await assertBudgetTarget(db, userId, input.categoryId, input.periodMonth, {
		excludeId: input.id,
		checkDuplicate:
			input.categoryId !== existing.categoryId || input.periodMonth !== existing.periodMonth
	});
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

export async function clearBudgetCarryover(db: Db, userId: string, id: string) {
	// Stamp carryoverFromPeriod with the PREVIOUS period (prevPeriodMonth of the
	// current cycle). The layout stale check is `carryoverFromPeriod !== prevPeriod`
	// so matching prevPeriod makes it evaluate to false — no re-apply on next load.
	// The action resolves prevPeriod server-side before calling this function.
	// We derive it here from the budget's own periodMonth to keep the repo self-contained.
	const [existing] = await db
		.select()
		.from(budgets)
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
		.limit(1);
	if (!existing) return null;
	const [yStr, mStr] = existing.periodMonth.split('-');
	const y = Number(yStr);
	const m = Number(mStr);
	const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
	const [row] = await db
		.update(budgets)
		.set({ carryoverDeficitCents: 0, carryoverFromPeriod: prev, updatedAt: Date.now() })
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
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
