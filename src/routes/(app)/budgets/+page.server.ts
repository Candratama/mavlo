import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	listBudgets,
	createBudget,
	updateBudget,
	deleteBudget
} from '$lib/server/repositories/budgets';
import { listCategories } from '$lib/server/repositories/categories';
import { computeBudgetSpent } from '$lib/server/repositories/budget-spent';
import { getPreferences } from '$lib/server/repositories/preferences';
import { budgetCreateSchema, budgetUpdateSchema, budgetIdSchema } from '$lib/validation/budget';
import { getCycleForPeriod, getCurrentCycle } from '$lib/utils/cycle.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const preferences = await getPreferences(db, user.id);
	const monthStartDay = preferences?.monthStartDay ?? 1;
	const timezone = preferences?.timezone ?? 'Asia/Jakarta';

	const periodMonth =
		event.url.searchParams.get('period') ??
		getCurrentCycle(new Date(), monthStartDay, timezone).periodMonth;

	const cycle = getCycleForPeriod(periodMonth, monthStartDay, timezone);

	const [budgets, spent, categories] = await Promise.all([
		listBudgets(db, user.id, { periodMonth }),
		computeBudgetSpent(db, user.id, cycle.start.getTime(), cycle.end.getTime() - 1),
		listCategories(db, user.id, { includeArchived: false })
	]);

	const expenseCategories = categories.filter((c) => c.kind === 'expense');
	const spentByCategory = Object.fromEntries(spent.entries());

	return {
		periodMonth,
		budgets,
		expenseCategories,
		categories,
		spentByCategory,
		monthStartDay,
		timezone
	};
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		await createBudget(db, user.id, parsed.data);
		return { success: true, action: 'create' };
	},
	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const updated = await updateBudget(db, user.id, parsed.data);
		if (!updated) return fail(404, { action: 'update', message: 'Budget not found' });
		return { success: true, action: 'update' };
	},
	delete: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'delete', message: 'Invalid id' });
		const deleted = await deleteBudget(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'delete', message: 'Budget not found' });
		return { success: true, action: 'delete' };
	}
};
