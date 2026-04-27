import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	listAccounts,
	createAccount,
	updateAccount,
	archiveAccount,
	unarchiveAccount,
	reorderAccounts
} from '$lib/server/repositories/accounts';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import {
	accountCreateSchema,
	accountUpdateSchema,
	accountIdSchema
} from '$lib/validation/account';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);
	const includeArchived = event.url.searchParams.get('archived') === '1';
	const [accounts, balances] = await Promise.all([
		listAccounts(db, user.id, { includeArchived }),
		computeAccountBalances(db, user.id)
	]);
	const accountsWithBalance = accounts.map((a) => ({
		...a,
		balanceCents: balances.get(a.id) ?? a.initialBalanceCents
	}));
	return { accounts: accountsWithBalance, includeArchived };
};

const formObject = (fd: FormData) => Object.fromEntries(fd.entries());

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const db = getDb(event.platform!.env.DB);
		const fd = await event.request.formData();
		const parsed = accountCreateSchema.safeParse(formObject(fd));
		if (!parsed.success) {
			return fail(400, { action: 'create', message: parsed.error.issues[0]?.message ?? 'Invalid input' });
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
			return fail(400, { action: 'update', message: parsed.error.issues[0]?.message ?? 'Invalid input' });
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
	}
};
