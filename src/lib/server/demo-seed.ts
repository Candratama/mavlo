import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import {
	accounts,
	categories,
	transactions,
	budgets,
	budgetSubsidies,
	debts,
	userPreferences
} from '$lib/server/db/schema';
import { DEFAULT_CATEGORIES } from '$lib/server/onboarding-defaults';
import { ensureDebtPaymentCategory } from '$lib/server/repositories/categories';

type Db = DrizzleD1Database<typeof schema>;

const periodMonthStr = (d = new Date()) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const startOfTodayUtc = () => {
	const d = new Date();
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const daysAgoMs = (n: number) => startOfTodayUtc() - n * 24 * 60 * 60 * 1000;
const todayMs = () => startOfTodayUtc();

interface SeededIds {
	accountIds: { bca: string; cash: string; gopay: string; savings: string };
	categoryIds: Map<string, string>;
}

export async function seedDemoData(db: Db, userId: string): Promise<void> {
	await db.insert(userPreferences).values({
		userId,
		currency: 'IDR',
		locale: 'id-ID',
		timezone: 'Asia/Jakarta'
	});

	const seedAccounts = await db
		.insert(accounts)
		.values([
			{
				userId,
				name: 'BCA',
				type: 'bank',
				currency: 'IDR',
				initialBalanceCents: 580000000,
				color: '#3b82f6'
			},
			{
				userId,
				name: 'Cash',
				type: 'cash',
				currency: 'IDR',
				initialBalanceCents: 25000000,
				color: '#f59e0b'
			},
			{
				userId,
				name: 'GoPay',
				type: 'wallet',
				currency: 'IDR',
				initialBalanceCents: 12500000,
				color: '#10b981'
			},
			{
				userId,
				name: 'Savings',
				type: 'savings',
				currency: 'IDR',
				initialBalanceCents: 1500000000,
				color: '#ec4899'
			}
		])
		.returning();

	const seededIds: SeededIds = {
		accountIds: {
			bca: seedAccounts.find((a) => a.name === 'BCA')!.id,
			cash: seedAccounts.find((a) => a.name === 'Cash')!.id,
			gopay: seedAccounts.find((a) => a.name === 'GoPay')!.id,
			savings: seedAccounts.find((a) => a.name === 'Savings')!.id
		},
		categoryIds: new Map()
	};

	const seedCategories = await db
		.insert(categories)
		.values(
			DEFAULT_CATEGORIES.map((c) => ({
				userId,
				name: c.name,
				kind: c.kind,
				icon: c.icon,
				color: c.color
			}))
		)
		.returning();
	for (const c of seedCategories) seededIds.categoryIds.set(c.name, c.id);

	const cat = (name: string) => seededIds.categoryIds.get(name) ?? null;

	await db.insert(transactions).values([
		{
			userId,
			accountId: seededIds.accountIds.bca,
			categoryId: cat('Salary'),
			amountCents: 750000000,
			kind: 'income',
			note: 'Monthly salary',
			occurredAt: daysAgoMs(2),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.cash,
			categoryId: cat('Food'),
			amountCents: 5500000,
			kind: 'expense',
			note: 'Lunch',
			occurredAt: todayMs(),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.gopay,
			categoryId: cat('Transport'),
			amountCents: 2500000,
			kind: 'expense',
			note: 'Gojek to office',
			occurredAt: todayMs(),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.bca,
			categoryId: cat('Bills'),
			amountCents: 35000000,
			kind: 'expense',
			note: 'Electricity + internet',
			occurredAt: daysAgoMs(1),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.bca,
			categoryId: cat('Entertainment'),
			amountCents: 12000000,
			kind: 'expense',
			note: 'Movie night',
			occurredAt: daysAgoMs(3),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.cash,
			categoryId: cat('Shopping'),
			amountCents: 18500000,
			kind: 'expense',
			note: 'Groceries',
			occurredAt: daysAgoMs(4),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.bca,
			categoryId: null,
			transferToAccountId: seededIds.accountIds.savings,
			amountCents: 200000000,
			kind: 'transfer',
			note: 'Savings deposit',
			occurredAt: daysAgoMs(5),
			isSeed: true
		}
	]);

	const periodMonth = periodMonthStr();
	// Food limit is intentionally set below actual spending (5_500_000) to demonstrate overspent state.
	const budgetSeeds = [
		{ name: 'Food', limitCents: 4_000_000 },
		{ name: 'Transport', limitCents: 80_000_000 },
		{ name: 'Shopping', limitCents: 150_000_000 },
		{ name: 'Bills', limitCents: 120_000_000 }
	];
	const budgetRows = budgetSeeds
		.map((b) => ({ categoryId: cat(b.name), limitCents: b.limitCents }))
		.filter((b): b is { categoryId: string; limitCents: number } => b.categoryId !== null)
		.map((b) => ({ userId, categoryId: b.categoryId, periodMonth, limitCents: b.limitCents }));

	let seededBudgets: { id: string; categoryId: string }[] = [];
	if (budgetRows.length > 0) {
		seededBudgets = await db
			.insert(budgets)
			.values(budgetRows)
			.returning({ id: budgets.id, categoryId: budgets.categoryId });
	}

	// Seed a sample subsidy: Transport (slack) → Food (overspent).
	// Food spent 5_500_000 > limit 4_000_000 → overage 1_500_000.
	// Transport spent 2_500_000, limit 80_000_000 → slack 77_500_000.
	// Subsidy amount 1_000_000 ≤ min(1_500_000, 77_500_000). ✓
	const foodBudgetId = seededBudgets.find((b) => b.categoryId === cat('Food'))?.id;
	const transportBudgetId = seededBudgets.find((b) => b.categoryId === cat('Transport'))?.id;
	if (foodBudgetId && transportBudgetId) {
		await db.insert(budgetSubsidies).values({
			userId,
			periodMonth,
			fromBudgetId: transportBudgetId,
			toBudgetId: foodBudgetId,
			amountCents: 1_000_000,
			note: 'Demo subsidy: end-of-month food'
		});
	}

	// Seed a sample debt (Credit Card BCA) and one payment transaction.
	// Amounts use standard cents: 100 = Rp 1.00 (IDR), matching the rest of the seed.
	const [seededDebt] = await db
		.insert(debts)
		.values({
			userId,
			name: 'Credit Card BCA',
			type: 'credit_card',
			lender: 'Bank BCA',
			principalCents: 1_000_000_000, // Rp 10,000,000
			currentBalanceCents: 450_000_000, // Rp 4,500,000
			interestRatePct: 2600, // 26% (stored as basis points × 100)
			minimumPaymentCents: 25_000_000, // Rp 250,000
			dueDay: 15,
			startDate: daysAgoMs(90),
			accountId: seedAccounts.find((a) => a.type === 'bank')?.id ?? null,
			status: 'active'
		})
		.returning();

	const debtPaymentCatId = await ensureDebtPaymentCategory(db, userId);

	const accForPayment = seedAccounts.find((a) => a.type === 'bank' || a.type === 'cash');
	if (accForPayment && seededDebt) {
		await db.insert(transactions).values({
			userId,
			accountId: accForPayment.id,
			categoryId: debtPaymentCatId,
			debtId: seededDebt.id,
			amountCents: 50_000_000, // Rp 500,000
			kind: 'expense',
			note: 'Demo debt payment',
			occurredAt: daysAgoMs(5),
			isSeed: true
		});
		// Update balance to reflect the payment made
		await db
			.update(debts)
			.set({ currentBalanceCents: 400_000_000 }) // Rp 4,000,000
			.where(eq(debts.id, seededDebt.id));
	}
}
