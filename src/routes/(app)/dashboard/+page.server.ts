import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import { listTransactions } from '$lib/server/repositories/transactions';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import {
	computeSpendingByCategory,
	computeDailySpending,
	computeMonthlyIncomeExpense
} from '$lib/server/repositories/dashboard-stats';
import { getPreferences } from '$lib/server/repositories/preferences';
import { getCurrentCycle } from '$lib/utils/cycle.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	const preferences = await getPreferences(db, user.id);
	const monthStartDay = preferences?.monthStartDay ?? 1;
	const timezone = preferences?.timezone ?? 'Asia/Jakarta';

	const cycle = getCurrentCycle(new Date(), monthStartDay, timezone);

	const [
		balances,
		monthTxns,
		recentTxns,
		accounts,
		categories,
		spendingByCategory,
		dailySpending,
		monthlyIncomeExpense
	] = await Promise.all([
		computeAccountBalances(db, user.id),
		listTransactions(db, user.id, { fromMs: cycle.start.getTime(), toMs: cycle.end.getTime() - 1 }),
		listTransactions(db, user.id, {}),
		listAccounts(db, user.id, { includeArchived: false }),
		listCategories(db, user.id, { includeArchived: false }),
		computeSpendingByCategory(db, user.id, cycle.periodMonth),
		computeDailySpending(db, user.id, cycle.periodMonth),
		computeMonthlyIncomeExpense(db, user.id, 6, cycle.periodMonth)
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

	const recent = recentTxns.slice(0, 5).map((t) => {
		const cat = t.categoryId ? categoryById.get(t.categoryId) : null;
		const acc = accountById.get(t.accountId);
		return {
			id: t.id,
			kind: t.kind,
			amountCents: t.amountCents,
			occurredAt: t.occurredAt,
			note: t.note,
			accountName: acc?.name ?? null,
			accountCurrency: acc?.currency ?? 'IDR',
			accountColor: acc?.color ?? null,
			accountType: acc?.type ?? null,
			categoryName: cat?.name ?? null,
			categoryColor: cat?.color ?? null,
			categoryIcon: cat?.icon ?? null
		};
	});

	const topCategoryEntry = spendingByCategory.length > 0
		? [...spendingByCategory].sort((a, b) => b.amountCents - a.amountCents)[0]
		: null;
	const topCategory = topCategoryEntry
		? {
			name: topCategoryEntry.categoryName,
			amountCents: topCategoryEntry.amountCents,
			percent: monthExpenseCents > 0 ? Math.round((topCategoryEntry.amountCents / monthExpenseCents) * 100) : 0
		}
		: null;

	return {
		netWorthCents,
		monthExpenseCents,
		monthIncomeCents,
		recent,
		spendingByCategory,
		dailySpending,
		monthlyIncomeExpense,
		displayCurrency: 'IDR',
		cycle: {
			periodMonth: cycle.periodMonth,
			startMs: cycle.start.getTime(),
			endMs: cycle.end.getTime()
		},
		monthStartDay,
		topCategory
	};
};
