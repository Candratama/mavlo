import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	listTransactions,
	createTransaction,
	updateTransaction,
	deleteTransaction,
	getTransaction
} from '$lib/server/repositories/transactions';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import { getPreferences } from '$lib/server/repositories/preferences';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionIdSchema,
	transactionListFilterSchema
} from '$lib/validation/transaction';
import { getCurrentCycle } from '$lib/utils/cycle.js';
import type { Actions, PageServerLoad } from './$types';

const dayMs = 24 * 60 * 60 * 1000;

const ymdToMs = (s: string | null): number | undefined => {
	if (!s) return undefined;
	const t = Date.parse(`${s}T00:00:00.000Z`);
	return Number.isNaN(t) ? undefined : t;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const preferences = await getPreferences(db, user.id);
	const monthStartDay = preferences?.monthStartDay ?? 1;
	const timezone = preferences?.timezone ?? 'Asia/Jakarta';

	const cycle = getCurrentCycle(new Date(), monthStartDay, timezone);

	const url = event.url;
	const fromParam = url.searchParams.get('from');
	const toParam = url.searchParams.get('to');
	let fromMs: number | undefined = ymdToMs(fromParam);
	let toMs: number | undefined = ymdToMs(toParam);
	if (fromMs === undefined && toMs === undefined) {
		fromMs = cycle.start.getTime();
		toMs = cycle.end.getTime();
	}

	const filter = transactionListFilterSchema.parse({
		fromMs,
		toMs: (toMs ?? cycle.end.getTime()) + dayMs - 1, // include end-of-day for `to` if user supplied YYYY-MM-DD
		accountId: url.searchParams.get('account') ?? undefined,
		categoryId: url.searchParams.get('category') ?? undefined,
		kind: url.searchParams.get('kind') ?? undefined
	});

	const [items, accounts, categories] = await Promise.all([
		listTransactions(db, user.id, filter),
		listAccounts(db, user.id, { includeArchived: false }),
		listCategories(db, user.id, { includeArchived: false })
	]);

	return {
		transactions: items,
		accounts,
		categories,
		filter: {
			from: fromParam ?? '',
			to: toParam ?? '',
			accountId: url.searchParams.get('account') ?? '',
			categoryId: url.searchParams.get('category') ?? '',
			kind: url.searchParams.get('kind') ?? ''
		}
	};
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
		if (parsed.data.kind === 'expense' || parsed.data.kind === 'transfer') {
			const balances = await computeAccountBalances(db, user.id);
			const sourceBalance = balances.get(parsed.data.accountId) ?? 0;
			if (parsed.data.amountCents > sourceBalance) {
				return fail(400, {
					action: 'create',
					message: 'Saldo gak cukup di akun sumber'
				});
			}
		}
		await createTransaction(db, user.id, parsed.data);
		return { success: true, action: 'create' };
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
		if (parsed.data.kind === 'expense' || parsed.data.kind === 'transfer') {
			const balances = await computeAccountBalances(db, user.id);
			const old = await getTransaction(db, user.id, parsed.data.id);
			let available = balances.get(parsed.data.accountId) ?? 0;
			if (old && old.accountId === parsed.data.accountId) {
				if (old.kind === 'expense' || old.kind === 'transfer') available += old.amountCents;
				else if (old.kind === 'income') available -= old.amountCents;
			}
			if (parsed.data.amountCents > available) {
				return fail(400, { action: 'update', message: 'Saldo gak cukup di akun sumber' });
			}
		}
		const updated = await updateTransaction(db, user.id, parsed.data);
		if (!updated) return fail(404, { action: 'update', message: 'Transaction not found' });
		return { success: true, action: 'update' };
	},
	delete: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = transactionIdSchema.safeParse(formObject(fd));
		if (!parsed.success) return fail(400, { action: 'delete', message: 'Invalid id' });
		const deleted = await deleteTransaction(db, user.id, parsed.data.id);
		if (!deleted) return fail(404, { action: 'delete', message: 'Transaction not found' });
		return { success: true, action: 'delete' };
	}
};
