import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { clearBudgetCarryover, getBudget, listBudgets } from '$lib/server/repositories/budgets';
import { listSubsidies } from '$lib/server/repositories/subsidies';
import { computeBudgetSpent } from '$lib/server/repositories/budget-spent';
import { computeSubsidyFlows } from '$lib/server/repositories/budget-effective';
import { budgetIdSchema } from '$lib/validation/budget';
import { purgeUserCache, allUserCacheNames } from '$lib/server/cf-cache';
import { getCurrentCycle, getCycleForPeriod } from '$lib/utils/cycle';
import { getPreferences } from '$lib/server/repositories/preferences';
import type { RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The layout only loads current-cycle budgets/subsidies. When this budget
// belongs to another period (reachable via the `?period=` filter on /budgets),
// fetch that period's data here; the page falls back to layout data otherwise.
export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const parent = await event.parent();
	if (parent.budgets.some((b) => b.id === event.params.id)) return { budgetView: null };
	const db = getDb(event.platform!.env.DB);
	const budget = await getBudget(db, user.id, event.params.id);
	if (!budget) return { budgetView: null };
	const cycle = getCycleForPeriod(budget.periodMonth, parent.monthStartDay, parent.timezone);
	const [budgets, budgetSpent, subsidies, subsidyFlows] = await Promise.all([
		listBudgets(db, user.id, { periodMonth: budget.periodMonth }),
		computeBudgetSpent(db, user.id, cycle.start.getTime(), cycle.end.getTime() - 1),
		listSubsidies(db, user.id, { periodMonth: budget.periodMonth }),
		computeSubsidyFlows(db, user.id, budget.periodMonth)
	]);
	return {
		budgetView: {
			budget,
			budgets,
			spentByCategory: Object.fromEntries(budgetSpent.entries()) as Record<string, number>,
			subsidies,
			subsidyFlowByBudget: Object.fromEntries(subsidyFlows.entries()) as Record<
				string,
				{ in: number; out: number }
			>
		}
	};
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

async function purgeUserCaches(event: RequestEvent, userId: string) {
	const db = getDb(event.platform!.env.DB);
	const prefs = await getPreferences(db, userId);
	const cycle = getCurrentCycle(
		new Date(),
		prefs?.monthStartDay ?? 1,
		prefs?.timezone ?? 'Asia/Jakarta'
	);
	await purgeUserCache(userId, allUserCacheNames(cycle.periodMonth, 6));
}

export const actions = {
	clearCarryover: async (event: RequestEvent) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'clearCarryover', message: 'Invalid id' });
		const updated = await clearBudgetCarryover(db, user.id, parsed.data.id);
		if (!updated) return fail(404, { action: 'clearCarryover', message: 'Budget not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'clearCarryover' };
	}
};
