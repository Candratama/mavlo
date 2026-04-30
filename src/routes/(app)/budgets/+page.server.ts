import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	createBudget,
	updateBudget,
	deleteBudget
} from '$lib/server/repositories/budgets';
import { budgetCreateSchema, budgetUpdateSchema, budgetIdSchema } from '$lib/validation/budget';
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
	}
};
