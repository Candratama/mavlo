import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { clearBudgetCarryover } from '$lib/server/repositories/budgets';
import { budgetIdSchema } from '$lib/validation/budget';
import { purgeUserCache, allUserCacheNames } from '$lib/server/cf-cache';
import { getCurrentCycle } from '$lib/utils/cycle';
import { getPreferences } from '$lib/server/repositories/preferences';
import type { RequestEvent } from '@sveltejs/kit';

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
