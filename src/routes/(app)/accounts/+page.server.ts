import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	createAccount,
	updateAccount,
	archiveAccount,
	unarchiveAccount,
	getAccount
} from '$lib/server/repositories/accounts';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import { getOrCreateAdjustmentCategory } from '$lib/server/repositories/categories';
import { createTransaction } from '$lib/server/repositories/transactions';
import { accountCreateSchema, accountUpdateSchema, accountIdSchema } from '$lib/validation/account';
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
		const parsed = accountCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		await createAccount(db, user.id, parsed.data);
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'create' };
	},

	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = accountUpdateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		const updated = await updateAccount(db, user.id, parsed.data);
		if (!updated) return fail(404, { action: 'update', message: 'Account not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'update' };
	},

	archive: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = accountIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'archive', message: 'Invalid id' });
		await archiveAccount(db, user.id, parsed.data.id);
		return { success: true, action: 'archive' };
	},

	unarchive: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = accountIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'unarchive', message: 'Invalid id' });
		await unarchiveAccount(db, user.id, parsed.data.id);
		return { success: true, action: 'unarchive' };
	},

	adjust: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const accountId = String(fd.get('id') ?? '');
		const targetRaw = String(fd.get('targetCents') ?? '');
		const note = String(fd.get('note') ?? '').trim() || null;
		const targetCents = Number(targetRaw);
		if (!accountId) return fail(400, { action: 'adjust', message: 'Account required' });
		if (!Number.isFinite(targetCents))
			return fail(400, { action: 'adjust', message: 'Invalid amount' });

		const account = await getAccount(db, user.id, accountId);
		if (!account) return fail(404, { action: 'adjust', message: 'Account not found' });

		const balances = await computeAccountBalances(db, user.id);
		const current = balances.get(accountId) ?? account.initialBalanceCents;
		const delta = targetCents - current;
		if (delta === 0) return { success: true, action: 'adjust' };

		const kind: 'income' | 'expense' = delta > 0 ? 'income' : 'expense';
		const categoryId = await getOrCreateAdjustmentCategory(db, user.id, kind);

		await createTransaction(db, user.id, {
			accountId,
			categoryId,
			kind,
			amountCents: Math.abs(delta),
			occurredAt: Date.now(),
			note:
				note ?? `Adjustment to ${account.currency} ${(targetCents / 100).toLocaleString('id-ID')}`,
			transferToAccountId: undefined
		});

		await purgeUserCaches(event, user.id);
		return { success: true, action: 'adjust' };
	}
};
