import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	createBudget,
	updateBudget,
	deleteBudget,
	clearBudgetCarryover
} from '$lib/server/repositories/budgets';
import { ensureDebtPaymentCategory } from '$lib/server/repositories/categories';
import { createSubsidy, updateSubsidy, deleteSubsidy } from '$lib/server/repositories/subsidies';
import { budgetCreateSchema, budgetUpdateSchema, budgetIdSchema } from '$lib/validation/budget';
import { subsidyCreateSchema, subsidyUpdateSchema, subsidyIdSchema } from '$lib/validation/subsidy';
import { purgeUserCache, allUserCacheNames } from '$lib/server/cf-cache';
import { getCurrentCycle } from '$lib/utils/cycle';
import { getPreferences } from '$lib/server/repositories/preferences';
import type { Actions } from './$types';

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

async function purgeUserCaches(event: Parameters<Actions[string]>[0], userId: string) {
	const db = getDb(event.platform!.env.DB);
	const prefs = await getPreferences(db, userId);
	const cycle = getCurrentCycle(
		new Date(),
		prefs?.monthStartDay ?? 1,
		prefs?.timezone ?? 'Asia/Jakarta'
	);
	await purgeUserCache(userId, allUserCacheNames(cycle.periodMonth, 6));
}

async function getCycleResolver(
	event: Parameters<Actions[string]>[0],
	userId: string
): Promise<{ monthStartDay: number; timezone: string }> {
	const db = getDb(event.platform!.env.DB);
	const prefs = await getPreferences(db, userId);
	return {
		monthStartDay: prefs?.monthStartDay ?? 1,
		timezone: prefs?.timezone ?? 'Asia/Jakarta'
	};
}

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
		await purgeUserCaches(event, user.id);
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
		await purgeUserCaches(event, user.id);
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
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'delete' };
	},
	subsidize: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = subsidyCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'subsidize',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const cycle = await getCycleResolver(event, user.id);
		const result = await createSubsidy(db, user.id, parsed.data, cycle);
		if ('error' in result) {
			return fail(400, { action: 'subsidize', message: result.error });
		}
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'subsidize' };
	},
	updateSubsidy: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = subsidyUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'updateSubsidy',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const cycle = await getCycleResolver(event, user.id);
		const result = await updateSubsidy(db, user.id, parsed.data, cycle);
		if ('error' in result) {
			return fail(400, { action: 'updateSubsidy', message: result.error });
		}
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'updateSubsidy' };
	},
	deleteSubsidy: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = subsidyIdSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, { action: 'deleteSubsidy', message: 'Invalid id' });
		}
		const deleted = await deleteSubsidy(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'deleteSubsidy', message: 'Subsidy not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'deleteSubsidy' };
	},
	clearCarryover: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = budgetIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'clearCarryover', message: 'Invalid id' });
		const updated = await clearBudgetCarryover(db, user.id, parsed.data.id);
		if (!updated) return fail(404, { action: 'clearCarryover', message: 'Budget not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'clearCarryover' };
	},
	setDebtBudget: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const limitCents = Number(fd.get('limitCents'));
		const periodMonth = String(fd.get('periodMonth') ?? '');
		if (!Number.isFinite(limitCents) || limitCents <= 0) {
			return fail(400, { action: 'setDebtBudget', message: 'Limit must be positive' });
		}
		if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
			return fail(400, { action: 'setDebtBudget', message: 'Invalid period' });
		}
		const categoryId = await ensureDebtPaymentCategory(db, user.id);
		await createBudget(db, user.id, { categoryId, periodMonth, limitCents });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'setDebtBudget' };
	}
};
