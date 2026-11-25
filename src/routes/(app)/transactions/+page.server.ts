import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	createTransaction,
	updateTransaction,
	deleteTransaction,
	getTransaction
} from '$lib/server/repositories/transactions';
import { applyTransactionRules } from '$lib/server/repositories/transaction-rules';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionIdSchema
} from '$lib/validation/transaction';
import { purgeUserCache, allUserCacheNames } from '$lib/server/cf-cache';
import { getCurrentCycle, ymdToZonedDayStartMs } from '$lib/utils/cycle';
import { getPreferences } from '$lib/server/repositories/preferences';
import { RepoValidationError } from '$lib/server/repositories/errors';
import type { Actions } from './$types';

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

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

const parseDateMs = (s: FormDataEntryValue | null, timezone: string): number | undefined => {
	if (typeof s !== 'string' || !s) return undefined;
	const t = ymdToZonedDayStartMs(s, timezone);
	return Number.isNaN(t) ? undefined : t;
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const prefs = await getPreferences(db, user.id);
		const timezone = prefs?.timezone ?? 'Asia/Jakarta';
		const occurredAtMs = parseDateMs(fd.get('occurredAt'), timezone);
		const parsed = transactionCreateSchema.safeParse({
			...formObject(fd),
			occurredAt: occurredAtMs ?? 0
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'create',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		let created;
		try {
			const input = await applyTransactionRules(db, user.id, parsed.data);
			created = await createTransaction(db, user.id, input);
		} catch (err) {
			if (!(err instanceof RepoValidationError)) throw err;
			return fail(400, { action: 'create', message: err.message });
		}
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'create', transaction: created };
	},
	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const prefs = await getPreferences(db, user.id);
		const timezone = prefs?.timezone ?? 'Asia/Jakarta';
		const occurredAtMs = parseDateMs(fd.get('occurredAt'), timezone);
		const parsed = transactionUpdateSchema.safeParse({
			...formObject(fd),
			occurredAt: occurredAtMs ?? 0
		});
		if (!parsed.success) {
			return fail(400, {
				action: 'update',
				message: parsed.error.issues[0]?.message ?? 'Invalid input'
			});
		}
		let updated;
		try {
			const input = await applyTransactionRules(db, user.id, parsed.data, parsed.data.id);
			updated = await updateTransaction(db, user.id, input);
		} catch (err) {
			if (!(err instanceof RepoValidationError)) throw err;
			return fail(400, { action: 'update', message: err.message });
		}
		if (!updated) return fail(404, { action: 'update', message: 'Transaction not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'update', transaction: updated };
	},
	delete: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = transactionIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'delete', message: 'Invalid id' });
		const existing = await getTransaction(db, user.id, parsed.data.id);
		if (!existing) return fail(404, { action: 'delete', message: 'Transaction not found' });
		if ((user as { isDemo?: boolean }).isDemo && existing.isSeed) {
			return fail(403, {
				action: 'delete',
				message: 'Demo: seed data cannot be deleted. Only your own transactions can be removed.'
			});
		}
		const deleted = await deleteTransaction(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'delete', message: 'Transaction not found' });
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'delete', id: parsed.data.id };
	}
};
