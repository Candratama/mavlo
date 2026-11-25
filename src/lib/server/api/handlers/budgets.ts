import {
	budgetCreateSchema,
	budgetUpdateSchema,
	budgetListFilterSchema
} from '$lib/validation/budget';
import * as repo from '$lib/server/repositories/budgets';
import { computeBudgetSpent } from '$lib/server/repositories/budget-spent';
import { computeSubsidyFlows } from '$lib/server/repositories/budget-effective';
import { getPreferences } from '$lib/server/repositories/preferences';
import { getCycleForPeriod } from '$lib/utils/cycle';
import { ApiError } from '../errors';
import { type Db, firstIssue } from './shared';

type Budget = NonNullable<Awaited<ReturnType<typeof repo.getBudget>>>;

/**
 * Attach the budget's cycle bounds and live spending, computed the same way as
 * the app (+layout.server.ts), so agents don't have to resolve the user's
 * month-start day and timezone themselves.
 */
async function withSpending(db: Db, userId: string, rows: Budget[]) {
	if (rows.length === 0) return [];
	const prefs = await getPreferences(db, userId);
	const monthStartDay = prefs?.monthStartDay ?? 1;
	const timezone = prefs?.timezone ?? 'Asia/Jakarta';

	const periods = [...new Set(rows.map((r) => r.periodMonth))];
	const byPeriod = new Map(
		await Promise.all(
			periods.map(async (p) => {
				const cycle = getCycleForPeriod(p, monthStartDay, timezone);
				const [spent, flows] = await Promise.all([
					computeBudgetSpent(db, userId, cycle.start.getTime(), cycle.end.getTime() - 1),
					computeSubsidyFlows(db, userId, p)
				]);
				return [p, { cycle, spent, flows }] as const;
			})
		)
	);

	return rows.map((r) => {
		const { cycle, spent, flows } = byPeriod.get(r.periodMonth)!;
		const spentCents = spent.get(r.categoryId) ?? 0;
		const flow = flows.get(r.id) ?? { in: 0, out: 0 };
		return {
			...r,
			periodStart: cycle.start.getTime(),
			periodEnd: cycle.end.getTime(),
			spentCents,
			subsidyInCents: flow.in,
			subsidyOutCents: flow.out,
			remainingCents: r.limitCents + flow.in - flow.out - r.carryoverDeficitCents - spentCents
		};
	});
}

async function one(db: Db, userId: string, row: Budget) {
	const [out] = await withSpending(db, userId, [row]);
	return out;
}

export async function listBgt(db: Db, userId: string, url: URL) {
	const parsed = budgetListFilterSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return withSpending(db, userId, await repo.listBudgets(db, userId, parsed.data));
}

export async function createBgt(db: Db, userId: string, body: unknown) {
	const parsed = budgetCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return one(db, userId, await repo.createBudget(db, userId, parsed.data));
}

export async function getBgt(db: Db, userId: string, id: string) {
	const row = await repo.getBudget(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Budget not found');
	return one(db, userId, row);
}

export async function updateBgt(db: Db, userId: string, id: string, body: unknown) {
	const parsed = budgetUpdateSchema.safeParse({
		...(typeof body === 'object' && body !== null ? body : {}),
		id
	});
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateBudget(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Budget not found');
	return one(db, userId, row);
}

export async function deleteBgt(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteBudget(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Budget not found');
}
