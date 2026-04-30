import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { userPreferences } from '$lib/server/db/schema';
import {
	listAccounts,
	createAccount,
	updateAccount,
	archiveAccount,
	unarchiveAccount,
	reorderAccounts,
	getAccount
} from '$lib/server/repositories/accounts';
import {
	computeAccountBalances,
	computeAccountPeriodSummary
} from '$lib/server/repositories/balances';
import { getOrCreateAdjustmentCategory } from '$lib/server/repositories/categories';
import { createTransaction } from '$lib/server/repositories/transactions';
import { accountCreateSchema, accountUpdateSchema, accountIdSchema } from '$lib/validation/account';
import { getCurrentCycle, formatCycleLabel } from '$lib/utils/cycle';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);
	const includeArchived = event.url.searchParams.get('archived') === '1';

	const [prefs] = await db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, user.id))
		.limit(1);
	const startDay = prefs?.monthStartDay ?? 1;
	const timezone = prefs?.timezone ?? 'Asia/Jakarta';
	const locale = prefs?.locale ?? 'id-ID';
	const cycle = getCurrentCycle(new Date(), startDay, timezone);

	const [accounts, balances, periodSummary] = await Promise.all([
		listAccounts(db, user.id, { includeArchived }),
		computeAccountBalances(db, user.id),
		computeAccountPeriodSummary(db, user.id, cycle.start.getTime(), cycle.end.getTime() - 1)
	]);
	const accountsWithBalance = accounts.map((a) => {
		const s = periodSummary.get(a.id);
		return {
			...a,
			balanceCents: balances.get(a.id) ?? a.initialBalanceCents,
			periodIncomeCents: s?.incomeCents ?? 0,
			periodExpenseCents: s?.expenseCents ?? 0
		};
	});
	return {
		accounts: accountsWithBalance,
		includeArchived,
		periodLabel: formatCycleLabel(cycle, startDay, locale)
	};
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

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

	reorder: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const idsRaw = fd.get('ids');
		if (typeof idsRaw !== 'string') return fail(400, { action: 'reorder', message: 'Invalid ids' });
		const ids = idsRaw.split(',').filter(Boolean);
		if (ids.length === 0) return fail(400, { action: 'reorder', message: 'Empty ids' });
		await reorderAccounts(db, user.id, ids);
		return { success: true, action: 'reorder' };
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

		return { success: true, action: 'adjust' };
	}
};
