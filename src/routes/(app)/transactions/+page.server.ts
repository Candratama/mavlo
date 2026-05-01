import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	createTransaction,
	updateTransaction,
	deleteTransaction,
	getTransaction
} from '$lib/server/repositories/transactions';
import { getAccount } from '$lib/server/repositories/accounts';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionIdSchema
} from '$lib/validation/transaction';
import { purgeUserCache, allUserCacheNames } from '$lib/server/cf-cache';
import { getCurrentCycle } from '$lib/utils/cycle';
import { getPreferences } from '$lib/server/repositories/preferences';
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

const ymdToMs = (s: string | null): number | undefined => {
	if (!s) return undefined;
	const t = Date.parse(`${s}T00:00:00.000Z`);
	return Number.isNaN(t) ? undefined : t;
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

const parseDateMs = (s: FormDataEntryValue | null): number | undefined => {
	if (typeof s !== 'string' || !s) return undefined;
	return ymdToMs(s);
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const occurredAtMs = parseDateMs(fd.get('occurredAt'));
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
		const sourceAccount = await getAccount(db, user.id, parsed.data.accountId);
		if (!sourceAccount) {
			return fail(400, { action: 'create', message: 'Source account not found' });
		}
		if (
			sourceAccount.type === 'savings' &&
			(parsed.data.kind === 'income' || parsed.data.kind === 'expense')
		) {
			return fail(400, {
				action: 'create',
				message: 'Savings accounts only support transfers, not income/expense'
			});
		}
		if (parsed.data.kind === 'expense' || parsed.data.kind === 'transfer') {
			const balances = await computeAccountBalances(db, user.id);
			const sourceBalance = balances.get(parsed.data.accountId) ?? 0;
			if (parsed.data.amountCents > sourceBalance) {
				return fail(400, {
					action: 'create',
					message: 'Insufficient balance in source account'
				});
			}
		}
		const created = await createTransaction(db, user.id, parsed.data);
		await purgeUserCaches(event, user.id);
		return { success: true, action: 'create', transaction: created };
	},
	update: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const occurredAtMs = parseDateMs(fd.get('occurredAt'));
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
		const sourceAccount = await getAccount(db, user.id, parsed.data.accountId);
		if (!sourceAccount) {
			return fail(400, { action: 'update', message: 'Source account not found' });
		}
		if (
			sourceAccount.type === 'savings' &&
			(parsed.data.kind === 'income' || parsed.data.kind === 'expense')
		) {
			return fail(400, {
				action: 'update',
				message: 'Savings accounts only support transfers, not income/expense'
			});
		}
		if (parsed.data.kind === 'expense' || parsed.data.kind === 'transfer') {
			const balances = await computeAccountBalances(db, user.id);
			const old = await getTransaction(db, user.id, parsed.data.id);
			let available = balances.get(parsed.data.accountId) ?? 0;
			if (old && old.accountId === parsed.data.accountId) {
				if (old.kind === 'expense' || old.kind === 'transfer') available += old.amountCents;
				else if (old.kind === 'income') available -= old.amountCents;
			}
			if (parsed.data.amountCents > available) {
				return fail(400, { action: 'update', message: 'Insufficient balance in source account' });
			}
		}
		const updated = await updateTransaction(db, user.id, parsed.data);
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
