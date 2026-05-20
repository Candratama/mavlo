import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	createDebt,
	updateDebt,
	deleteDebt,
	markDebtPaidOff
} from '$lib/server/repositories/debts';
import { createTransaction } from '$lib/server/repositories/transactions';
import { ensureLoanProceedsCategory } from '$lib/server/repositories/categories';
import { debtCreateSchema, debtUpdateSchema, debtIdSchema } from '$lib/validation/debt';
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
		const funded = fd.get('funded') === '1';
		const fundedAccountId = (fd.get('fundedAccountId') as string | null) || null;
		const parsed = debtCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const result = await createDebt(db, user.id, parsed.data);
		if ('error' in result) return fail(400, { action: 'create', message: result.error });

		// Funding flow: user just received the money → record as income tx.
		// Skip for credit_card (no upfront cash, balance built via spending).
		if (funded && fundedAccountId && parsed.data.type !== 'credit_card') {
			const categoryId = await ensureLoanProceedsCategory(db, user.id);
			await createTransaction(db, user.id, {
				accountId: fundedAccountId,
				categoryId,
				amountCents: parsed.data.principalCents,
				kind: 'income',
				note: `Loan proceeds — ${parsed.data.name}`,
				occurredAt: parsed.data.startDate
			});
		}

		await purgeUserCaches(event, user.id);
		return { success: true, action: 'create' };
	},
	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = debtUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const result = await updateDebt(db, user.id, parsed.data);
		if ('error' in result) return fail(400, { action: 'update', message: result.error });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'update' };
	},
	delete: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = debtIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'delete', message: 'Invalid id' });
		const deleted = await deleteDebt(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'delete', message: 'Debt not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'delete' };
	},
	markPaidOff: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = debtIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'markPaidOff', message: 'Invalid id' });
		const result = await markDebtPaidOff(db, user.id, parsed.data.id);
		if (!result) return fail(404, { action: 'markPaidOff', message: 'Debt not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'markPaidOff' };
	}
};
