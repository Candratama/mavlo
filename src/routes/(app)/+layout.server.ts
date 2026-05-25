import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guards';
import { getDb } from '$lib/server/db';
import {
	budgets as budgetsTable,
	debts as debtsTable,
	userPreferences,
	users
} from '$lib/server/db/schema';
import { listAccounts } from '$lib/server/repositories/accounts';
import { listCategories } from '$lib/server/repositories/categories';
import {
	computeAccountBalances,
	computeAccountPeriodSummary
} from '$lib/server/repositories/balances';
import { listTransactions } from '$lib/server/repositories/transactions';
import { listBudgets } from '$lib/server/repositories/budgets';
import { computeBudgetSpent } from '$lib/server/repositories/budget-spent';
import {
	computeSpendingByCategory,
	computeDailySpending,
	computeMonthlyIncomeExpense,
	computeFinancialHealth
} from '$lib/server/repositories/dashboard-stats';
import { listSubsidies } from '$lib/server/repositories/subsidies';
import { computeSubsidyFlows } from '$lib/server/repositories/budget-effective';
import { listDebts } from '$lib/server/repositories/debts';
import { computeDebtTotals } from '$lib/server/repositories/debt-stats';
import { getCurrentCycle, getCycleForPeriod, formatCycleLabel, prevPeriodMonth } from '$lib/utils/cycle';
import { cachedJson, CACHE_KEYS } from '$lib/server/cf-cache';
import type { LayoutServerLoad } from './$types';

// Layout-level loader: hoists ALL app-wide data so per-page navigation runs zero
// server fetches. Each page-level `+page.server.ts` only owns its form `actions`.
// `invalidateAll()` after mutations re-runs this once to refresh shared state.
export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const db = getDb(event.platform!.env.DB);

	event.depends('app:data');

	const [userRow] = await db
		.select({ onboardedAt: users.onboardedAt })
		.from(users)
		.where(eq(users.id, user.id))
		.limit(1);
	if (!userRow?.onboardedAt) {
		throw redirect(302, '/onboarding');
	}

	let prefs = (
		await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1)
	)[0];
	if (!prefs) {
		prefs = (await db.insert(userPreferences).values({ userId: user.id }).returning())[0];
	}

	const monthStartDay = prefs.monthStartDay ?? 1;
	const timezone = prefs.timezone ?? 'Asia/Jakarta';
	const locale = prefs.locale ?? 'id-ID';
	const cycle = getCurrentCycle(new Date(), monthStartDay, timezone);

	const cycleFromMs = cycle.start.getTime();
	const cycleToMs = cycle.end.getTime() - 1;

	const [
		accounts,
		allCategories,
		balances,
		periodSummary,
		transactions,
		budgetListRaw,
		budgetSpent,
		spendingByCategory,
		dailySpending,
		monthlyIncomeExpense,
		financialHealth,
		subsidies,
		subsidyFlows,
		debtListRaw,
		debtTotalsRaw
	] = await Promise.all([
		listAccounts(db, user.id, { includeArchived: true }),
		listCategories(db, user.id, { includeArchived: true }),
		computeAccountBalances(db, user.id),
		computeAccountPeriodSummary(db, user.id, cycleFromMs, cycleToMs),
		listTransactions(db, user.id, {}),
		listBudgets(db, user.id, { periodMonth: cycle.periodMonth }),
		computeBudgetSpent(db, user.id, cycleFromMs, cycleToMs),
		cachedJson(user.id, CACHE_KEYS.spendingByCategory(cycle.periodMonth), 60, () =>
			computeSpendingByCategory(db, user.id, cycle.periodMonth, monthStartDay, timezone)
		),
		cachedJson(user.id, CACHE_KEYS.dailySpending(cycle.periodMonth), 60, () =>
			computeDailySpending(db, user.id, cycle.periodMonth, monthStartDay, timezone)
		),
		cachedJson(user.id, CACHE_KEYS.monthlyIncomeExpense(cycle.periodMonth, 6), 60, () =>
			computeMonthlyIncomeExpense(db, user.id, 6, cycle.periodMonth, monthStartDay, timezone)
		),
		cachedJson(user.id, CACHE_KEYS.financialHealth(cycle.periodMonth), 60, () =>
			computeFinancialHealth(db, user.id, cycle.periodMonth, monthStartDay, timezone)
		),
		listSubsidies(db, user.id, { periodMonth: cycle.periodMonth }),
		computeSubsidyFlows(db, user.id, cycle.periodMonth),
		listDebts(db, user.id, {}),
		computeDebtTotals(db, user.id, Date.now())
	]);

	// Carryover: for each current-period budget whose carryoverFromPeriod is stale,
	// compute uncovered overage from previous period and persist as carryover deficit.
	const prevPeriod = prevPeriodMonth(cycle.periodMonth);
	const staleBudgets = budgetListRaw.filter((b) => b.carryoverFromPeriod !== prevPeriod);
	let budgetList = budgetListRaw;
	if (staleBudgets.length > 0) {
		const prevBudgets = await listBudgets(db, user.id, { periodMonth: prevPeriod });
		const prevByCategoryId = new Map(prevBudgets.map((b) => [b.categoryId, b]));
		const prevCycle = getCycleForPeriod(prevPeriod, monthStartDay, timezone);
		const [prevSpent, prevFlows] = await Promise.all([
			computeBudgetSpent(db, user.id, prevCycle.start.getTime(), prevCycle.end.getTime() - 1),
			computeSubsidyFlows(db, user.id, prevPeriod)
		]);
		for (const cur of staleBudgets) {
			const prev = prevByCategoryId.get(cur.categoryId);
			let carryover = 0;
			if (prev) {
				const spent = prevSpent.get(prev.categoryId) ?? 0;
				const flow = prevFlows.get(prev.id) ?? { in: 0, out: 0 };
				const effLimit =
					prev.limitCents + flow.in - flow.out - prev.carryoverDeficitCents;
				carryover = Math.max(0, spent - effLimit);
			}
			await db
				.update(budgetsTable)
				.set({
					carryoverDeficitCents: carryover,
					carryoverFromPeriod: prevPeriod,
					updatedAt: Date.now()
				})
				.where(eq(budgetsTable.id, cur.id));
		}
		budgetList = await listBudgets(db, user.id, { periodMonth: cycle.periodMonth });
	}

	let debtList = debtListRaw;
	let debtTotals = debtTotalsRaw;

	// Debt interest accrual + late-payment detection at period rollover.
	// For each active debt whose interestAppliedFromPeriod !== current period:
	//   1. Bump currentBalance by one month of interest (balance × APR/12)
	//   2. Stamp interestAppliedFromPeriod = current period
	// For each active debt with dueDay set, current cycle day > dueDay, and no
	// payment recorded in current cycle → flip status to 'in_arrears'.
	const debtsNeedingInterest = debtList.filter(
		(d) =>
			d.status === 'active' &&
			d.interestRatePct > 0 &&
			d.currentBalanceCents > 0 &&
			d.interestAppliedFromPeriod !== cycle.periodMonth
	);
	let debtsRefreshNeeded = false;
	for (const d of debtsNeedingInterest) {
		const monthlyInterest = Math.round(
			(d.currentBalanceCents * d.interestRatePct) / 12 / 100 / 100
		);
		await db
			.update(debtsTable)
			.set({
				currentBalanceCents: d.currentBalanceCents + monthlyInterest,
				interestAppliedFromPeriod: cycle.periodMonth,
				updatedAt: Date.now()
			})
			.where(eq(debtsTable.id, d.id));
		debtsRefreshNeeded = true;
	}

	// Late-payment detection. Only checks debts with dueDay set, in active status.
	const nowZ = new Date(Date.now());
	const dayOfMonth = nowZ.getUTCDate();
	for (const d of debtList) {
		if (d.status !== 'active' || !d.dueDay) continue;
		if (dayOfMonth <= d.dueDay) continue;
		// Check if any payment in current cycle
		const cycleHasPayment = transactions.some(
			(t) =>
				(t as { debtId?: string | null }).debtId === d.id &&
				t.kind === 'expense' &&
				t.occurredAt >= cycleFromMs &&
				t.occurredAt < cycle.end.getTime()
		);
		if (!cycleHasPayment) {
			await db
				.update(debtsTable)
				.set({ status: 'in_arrears', updatedAt: Date.now() })
				.where(eq(debtsTable.id, d.id));
			debtsRefreshNeeded = true;
		}
	}

	if (debtsRefreshNeeded) {
		debtList = await listDebts(db, user.id, {});
		debtTotals = await computeDebtTotals(db, user.id, Date.now());
	}

	const categories = allCategories.filter((c) => !c.archived);

	const allAccountsWithBalance = accounts.map((a) => {
		const s = periodSummary.get(a.id);
		return {
			...a,
			balanceCents: balances.get(a.id) ?? a.initialBalanceCents,
			periodIncomeCents: s?.incomeCents ?? 0,
			periodExpenseCents: s?.expenseCents ?? 0
		};
	});
	const accountsWithBalance = allAccountsWithBalance.filter((a) => !a.archived);

	let savingsCents = 0;
	let operationalCents = 0;
	for (const a of accountsWithBalance) {
		if (a.type === 'savings') savingsCents += a.balanceCents;
		else operationalCents += a.balanceCents;
	}
	const subsidyFlowByBudget: Record<string, { in: number; out: number }> =
		Object.fromEntries(subsidyFlows.entries());

	const assignedCents = budgetList.reduce((s, b) => s + b.limitCents, 0);
	// Effective remaining per budget accounts for outgoing subsidy AND carryover
	// deficit from previous period.
	const remainingBudgetCents = budgetList.reduce((s, b) => {
		const spent = budgetSpent.get(b.categoryId) ?? 0;
		const flow = subsidyFlowByBudget[b.id] ?? { in: 0, out: 0 };
		return s + Math.max(0, b.limitCents + flow.in - spent - flow.out - b.carryoverDeficitCents);
	}, 0);
	const totalCashCents = savingsCents + operationalCents;
	const allocatedCents = savingsCents + remainingBudgetCents;

	// Unbudgeted: expense categories with spending this period but no budget row.
	const budgetedCategoryIds = new Set(budgetList.map((b) => b.categoryId));
	const unbudgetedCategories = categories
		.filter((c) => c.kind === 'expense' && !budgetedCategoryIds.has(c.id))
		.map((c) => ({
			categoryId: c.id,
			categoryName: c.name,
			categoryIcon: c.icon,
			categoryColor: c.color,
			spentCents: budgetSpent.get(c.id) ?? 0
		}))
		.filter((c) => c.spentCents > 0)
		.sort((a, b) => b.spentCents - a.spentCents);

	const spentByCategory: Record<string, number> = Object.fromEntries(budgetSpent.entries());

	// Dashboard stats
	const cycleTxns = transactions.filter(
		(t) => t.occurredAt >= cycleFromMs && t.occurredAt < cycle.end.getTime()
	);
	const monthIncomeCents = cycleTxns
		.filter((t) => t.kind === 'income')
		.reduce((s, t) => s + t.amountCents, 0);
	const monthExpenseCents = cycleTxns
		.filter((t) => t.kind === 'expense')
		.reduce((s, t) => s + t.amountCents, 0);
	const netWorthCents =
		Array.from(balances.values()).reduce((s, b) => s + b, 0) -
		debtTotals.totalBalanceCents +
		debtTotals.totalReceivableCents;
	const budgetLimitCents = assignedCents;
	const budgetSpentCents = budgetList.reduce((s, b) => s + (budgetSpent.get(b.categoryId) ?? 0), 0);

	const accountById = new Map(accounts.map((a) => [a.id, a]));
	const categoryById = new Map(categories.map((c) => [c.id, c]));
	const recent = transactions.slice(0, 5).map((t) => {
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

	const topCategoryEntry =
		spendingByCategory.length > 0
			? [...spendingByCategory].sort((a, b) => b.amountCents - a.amountCents)[0]
			: null;
	const topCategory = topCategoryEntry
		? {
				name: topCategoryEntry.categoryName,
				amountCents: topCategoryEntry.amountCents,
				percent:
					monthExpenseCents > 0
						? Math.round((topCategoryEntry.amountCents / monthExpenseCents) * 100)
						: 0
			}
		: null;

	return {
		user: {
			id: user.id,
			name: user.name,
			username: (user as { username?: string | null }).username ?? null,
			email: user.email,
			image: user.image,
			isDemo: (user as { isDemo?: boolean }).isDemo ?? false
		},
		preferences: prefs,
		monthStartDay,
		timezone,
		locale,
		displayCurrency: 'IDR',
		// Cycle
		cycle: {
			periodMonth: cycle.periodMonth,
			startMs: cycleFromMs,
			endMs: cycle.end.getTime()
		},
		periodLabel: formatCycleLabel(cycle, monthStartDay, locale),
		// Shared collections
		accounts: accountsWithBalance,
		allAccounts: allAccountsWithBalance,
		categories,
		allCategories,
		transactions,
		// Budgets page
		budgets: budgetList,
		expenseCategories: categories.filter((c) => c.kind === 'expense'),
		spentByCategory,
		subsidies,
		subsidyFlowByBudget,
		unbudgetedCategories,
		debts: debtList,
		debtTotals,
		periodMonth: cycle.periodMonth,
		allocation: {
			totalCashCents,
			savingsCents,
			operationalCents,
			assignedCents,
			remainingBudgetCents,
			allocatedCents,
			unallocatedCents: totalCashCents - allocatedCents
		},
		// Dashboard stats
		netWorthCents,
		monthExpenseCents,
		monthIncomeCents,
		recent,
		spendingByCategory,
		dailySpending,
		monthlyIncomeExpense,
		financialHealth,
		topCategory,
		budgetLimitCents,
		budgetSpentCents
	};
};
