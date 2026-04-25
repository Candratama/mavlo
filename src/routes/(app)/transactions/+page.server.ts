import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	listTransactions,
	createTransaction,
	updateTransaction,
	deleteTransaction
} from '$lib/server/repositories/transactions';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionIdSchema,
	transactionListFilterSchema
} from '$lib/validation/transaction';
import type { Actions, PageServerLoad } from './$types';

const dayMs = 24 * 60 * 60 * 1000;

const ymdToMs = (s: string | null): number | undefined => {
	if (!s) return undefined;
	const t = Date.parse(`${s}T00:00:00.000Z`);
	return Number.isNaN(t) ? undefined : t;
};

const startOfMonthUtc = () => {
	const d = new Date();
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

const endOfMonthUtc = () => {
	const d = new Date();
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const url = event.url;
	const fromParam = url.searchParams.get('from');
	const toParam = url.searchParams.get('to');
	const fromMs = ymdToMs(fromParam) ?? startOfMonthUtc();
	const toMs = ymdToMs(toParam) ?? endOfMonthUtc();

	const filter = transactionListFilterSchema.parse({
		fromMs,
		toMs: toMs + dayMs - 1, // include end-of-day for `to` if user supplied YYYY-MM-DD
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
			from: fromParam ?? new Date(fromMs).toISOString().slice(0, 10),
			to: toParam ?? new Date(toMs).toISOString().slice(0, 10),
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
