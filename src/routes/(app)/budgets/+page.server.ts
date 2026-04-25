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
import {
	budgetCreateSchema,
	budgetUpdateSchema,
	budgetIdSchema
} from '$lib/validation/budget';
import type { Actions, PageServerLoad } from './$types';

const currentPeriodMonth = (): string => {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const periodMonth = event.url.searchParams.get('period') ?? currentPeriodMonth();
	const [budgets, spent, categories] = await Promise.all([
		listBudgets(db, user.id, { periodMonth }),
		computeBudgetSpent(db, user.id, periodMonth),
		listCategories(db, user.id, { includeArchived: false })
	]);

	const expenseCategories = categories.filter((c) => c.kind === 'expense');
	const spentByCategory = Object.fromEntries(spent.entries());

	return {
		periodMonth,
		budgets,
		expenseCategories,
		categories,
		spentByCategory
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
			return fail(400, { action: 'create', message: parsed.error.issues[0]?.message ?? 'Invalid input' });
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
			return fail(400, { action: 'update', message: parsed.error.issues[0]?.message ?? 'Invalid input' });
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
