import { and, between, eq, isNotNull, ne } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
	budgets,
	budgetSubsidies,
	transactions
} from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type {
	SubsidyCreateInput,
	SubsidyUpdateInput
} from '$lib/validation/subsidy';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export type SubsidyRow = typeof budgetSubsidies.$inferSelect;
export type RepoError = { error: string };

export async function listSubsidies(
	db: Db,
	userId: string,
	filter: { periodMonth?: string }
): Promise<SubsidyRow[]> {
	const conds = [eq(budgetSubsidies.userId, userId)];
	if (filter.periodMonth)
		conds.push(eq(budgetSubsidies.periodMonth, filter.periodMonth));
	return db
		.select()
		.from(budgetSubsidies)
		.where(and(...conds));
}

export async function getSubsidy(
	db: Db,
	userId: string,
	id: string
): Promise<SubsidyRow | null> {
	const [row] = await db
		.select()
		.from(budgetSubsidies)
		.where(and(eq(budgetSubsidies.userId, userId), eq(budgetSubsidies.id, id)))
		.limit(1);
	return row ?? null;
}

async function getOwnedBudget(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(budgets)
		.where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
		.limit(1);
	return row ?? null;
}

function periodBounds(periodMonth: string): { fromMs: number; toMs: number } {
	const [y, m] = periodMonth.split('-').map(Number);
	const fromMs = Date.UTC(y, m - 1, 1);
	const toMs = Date.UTC(y, m, 1) - 1;
	return { fromMs, toMs };
}

async function spentForCategory(
	db: Db,
	userId: string,
	categoryId: string,
	periodMonth: string
): Promise<number> {
	const { fromMs, toMs } = periodBounds(periodMonth);
	const rows = await db
		.select({ amount: transactions.amountCents })
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				isNotNull(transactions.categoryId),
				eq(transactions.categoryId, categoryId),
				between(transactions.occurredAt, fromMs, toMs)
			)
		);
	return rows.reduce((s, r) => s + r.amount, 0);
}

async function sumSubsidy(
	db: Db,
	userId: string,
	field: 'fromBudgetId' | 'toBudgetId',
	budgetId: string,
	excludeId?: string
): Promise<number> {
	const col =
		field === 'fromBudgetId' ? budgetSubsidies.fromBudgetId : budgetSubsidies.toBudgetId;
	const conds = [eq(budgetSubsidies.userId, userId), eq(col, budgetId)];
	if (excludeId) conds.push(ne(budgetSubsidies.id, excludeId));
	const rows = await db
		.select({ amount: budgetSubsidies.amountCents })
		.from(budgetSubsidies)
		.where(and(...conds));
	return rows.reduce((s, r) => s + r.amount, 0);
}

export async function createSubsidy(
	db: Db,
	userId: string,
	input: SubsidyCreateInput
): Promise<SubsidyRow | RepoError> {
	if (input.fromBudgetId === input.toBudgetId)
		return { error: 'Source and target must differ' };
	if (input.amountCents <= 0)
		return { error: 'Amount must be positive' };

	const [from, to] = await Promise.all([
		getOwnedBudget(db, userId, input.fromBudgetId),
		getOwnedBudget(db, userId, input.toBudgetId)
	]);
	if (!from) return { error: 'Source budget not found' };
	if (!to) return { error: 'Target budget not found' };
	if (from.periodMonth !== to.periodMonth)
		return { error: 'Budgets must be in the same period' };

	const [toSpent, toSubsidyIn, fromSpent, fromSubsidyOut] = await Promise.all([
		spentForCategory(db, userId, to.categoryId, to.periodMonth),
		sumSubsidy(db, userId, 'toBudgetId', to.id),
		spentForCategory(db, userId, from.categoryId, from.periodMonth),
		sumSubsidy(db, userId, 'fromBudgetId', from.id)
	]);

	const targetOverage = toSpent - to.limitCents - toSubsidyIn;
	if (targetOverage <= 0) return { error: 'Target is not overspent' };

	const sourceSlack = from.limitCents - fromSpent - fromSubsidyOut;
	if (sourceSlack <= 0) return { error: 'Source has no remaining allocation' };

	const cap = Math.min(targetOverage, sourceSlack);
	if (input.amountCents > cap)
		return { error: `Amount exceeds cap (${cap})` };

	const [row] = await db
		.insert(budgetSubsidies)
		.values({
			userId,
			periodMonth: from.periodMonth,
			fromBudgetId: from.id,
			toBudgetId: to.id,
			amountCents: input.amountCents,
			note: input.note ?? null
		})
		.returning();
	return row;
}

export async function updateSubsidy(
	db: Db,
	userId: string,
	input: SubsidyUpdateInput
): Promise<SubsidyRow | RepoError> {
	const existing = await getSubsidy(db, userId, input.id);
	if (!existing) return { error: 'Subsidy not found' };

	if (input.amountCents <= 0) return { error: 'Amount must be positive' };

	const from = await getOwnedBudget(db, userId, existing.fromBudgetId);
	if (!from) return { error: 'Source budget not found' };

	const [fromSpent, fromSubsidyOutExcl] = await Promise.all([
		spentForCategory(db, userId, from.categoryId, from.periodMonth),
		sumSubsidy(db, userId, 'fromBudgetId', from.id, existing.id)
	]);

	const sourceSlackExcl = from.limitCents - fromSpent - fromSubsidyOutExcl;
	if (input.amountCents > sourceSlackExcl)
		return { error: `Amount exceeds source remaining (${sourceSlackExcl})` };

	const [row] = await db
		.update(budgetSubsidies)
		.set({
			amountCents: input.amountCents,
			note: input.note ?? null,
			updatedAt: Date.now()
		})
		.where(
			and(eq(budgetSubsidies.userId, userId), eq(budgetSubsidies.id, input.id))
		)
		.returning();
	return row ?? { error: 'Subsidy not found' };
}

export async function deleteSubsidy(
	db: Db,
	userId: string,
	id: string
): Promise<SubsidyRow | null> {
	const [row] = await db
		.delete(budgetSubsidies)
		.where(and(eq(budgetSubsidies.userId, userId), eq(budgetSubsidies.id, id)))
		.returning();
	return row ?? null;
}
