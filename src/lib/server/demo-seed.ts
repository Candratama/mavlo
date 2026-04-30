import { type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '$lib/server/db/schema';
import { accounts, categories, transactions, budgets, userPreferences } from '$lib/server/db/schema';
import { DEFAULT_CATEGORIES } from '$lib/server/onboarding-defaults';

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
				name: 'Tabungan',
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
			savings: seedAccounts.find((a) => a.name === 'Tabungan')!.id
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
			categoryId: cat('Gaji'),
			amountCents: 750000000,
			kind: 'income',
			note: 'Gajian bulan ini',
			occurredAt: daysAgoMs(2),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.cash,
			categoryId: cat('Makan'),
			amountCents: 5500000,
			kind: 'expense',
			note: 'Makan siang',
			occurredAt: todayMs(),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.gopay,
			categoryId: cat('Transport'),
			amountCents: 2500000,
			kind: 'expense',
			note: 'Gojek ke kantor',
			occurredAt: todayMs(),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.bca,
			categoryId: cat('Tagihan'),
			amountCents: 35000000,
			kind: 'expense',
			note: 'Listrik + internet',
			occurredAt: daysAgoMs(1),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.bca,
			categoryId: cat('Hiburan'),
			amountCents: 12000000,
			kind: 'expense',
			note: 'Nonton bioskop',
			occurredAt: daysAgoMs(3),
			isSeed: true
		},
		{
			userId,
			accountId: seededIds.accountIds.cash,
			categoryId: cat('Belanja'),
			amountCents: 18500000,
			kind: 'expense',
			note: 'Indomaret',
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
			note: 'Setor tabungan',
			occurredAt: daysAgoMs(5),
			isSeed: true
		}
	]);

	const periodMonth = periodMonthStr();
	const budgetSeeds = [
		{ name: 'Makan', limitCents: 200000000 },
		{ name: 'Transport', limitCents: 80000000 },
		{ name: 'Belanja', limitCents: 150000000 },
		{ name: 'Tagihan', limitCents: 120000000 }
	];
	const budgetRows = budgetSeeds
		.map((b) => ({ categoryId: cat(b.name), limitCents: b.limitCents }))
		.filter((b): b is { categoryId: string; limitCents: number } => b.categoryId !== null)
		.map((b) => ({ userId, categoryId: b.categoryId, periodMonth, limitCents: b.limitCents }));
	if (budgetRows.length > 0) {
		await db.insert(budgets).values(budgetRows);
	}
}
