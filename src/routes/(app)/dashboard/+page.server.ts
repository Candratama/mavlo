import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import { listTransactions } from '$lib/server/repositories/transactions';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const now = new Date();
	const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
	const monthEndMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1;

	const [balances, monthTxns, recentTxns, accounts, categories] = await Promise.all([
		computeAccountBalances(db, user.id),
		listTransactions(db, user.id, { fromMs: monthStartMs, toMs: monthEndMs }),
		listTransactions(db, user.id, {}),
		listAccounts(db, user.id, { includeArchived: false }),
		listCategories(db, user.id, { includeArchived: false })
	]);

	const accountById = new Map(accounts.map((a) => [a.id, a]));
	const categoryById = new Map(categories.map((c) => [c.id, c]));

	const netWorthCents = Array.from(balances.values()).reduce((sum, b) => sum + b, 0);

	const monthExpenseCents = monthTxns
		.filter((t) => t.kind === 'expense')
		.reduce((sum, t) => sum + t.amountCents, 0);
	const monthIncomeCents = monthTxns
		.filter((t) => t.kind === 'income')
		.reduce((sum, t) => sum + t.amountCents, 0);

	const recent = recentTxns.slice(0, 5).map((t) => ({
		id: t.id,
		kind: t.kind,
		amountCents: t.amountCents,
		occurredAt: t.occurredAt,
		note: t.note,
		accountName: accountById.get(t.accountId)?.name ?? null,
		accountCurrency: accountById.get(t.accountId)?.currency ?? 'IDR',
		categoryName: t.categoryId ? (categoryById.get(t.categoryId)?.name ?? null) : null
	}));

	return {
		netWorthCents,
		monthExpenseCents,
		monthIncomeCents,
		recent,
		displayCurrency: 'IDR'
	};
};
