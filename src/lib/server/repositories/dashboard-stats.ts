import { and, between, eq, isNotNull } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { categories, transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import { getCycleForPeriod, getZonedYearMonthDay } from '$lib/utils/cycle';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

const periodMonthBounds = (periodMonth: string) => {
	const [yStr, mStr] = periodMonth.split('-');
	const y = Number(yStr);
	const m = Number(mStr) - 1;
	return {
		fromMs: Date.UTC(y, m, 1),
		toMs: Date.UTC(y, m + 1, 1) - 1,
		daysInMonth: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
		year: y,
		monthIdx: m
	};
};

const formatPeriodMonth = (year: number, monthIdx: number) =>
	`${year}-${String(monthIdx + 1).padStart(2, '0')}`;

export interface SpendingByCategoryRow {
	categoryId: string;
	categoryName: string;
	amountCents: number;
}

export async function computeSpendingByCategory(
	db: Db,
	userId: string,
	periodMonth: string,
	monthStartDay: number,
	timezone: string
): Promise<SpendingByCategoryRow[]> {
	const cycle = getCycleForPeriod(periodMonth, monthStartDay, timezone);
	const fromMs = cycle.start.getTime();
	const toMs = cycle.end.getTime() - 1;

	const txRows = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				isNotNull(transactions.categoryId),
				between(transactions.occurredAt, fromMs, toMs)
			)
		);

	const catRows = await db.select().from(categories).where(eq(categories.userId, userId));

	const nameById = new Map(catRows.map((c) => [c.id, c.name]));

	const totals = new Map<string, number>();
	for (const t of txRows) {
		if (!t.categoryId) continue;
		totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountCents);
	}

	const result: SpendingByCategoryRow[] = [];
	for (const [categoryId, amountCents] of totals) {
		result.push({
			categoryId,
			categoryName: nameById.get(categoryId) ?? 'Unknown',
			amountCents
		});
	}
	result.sort((a, b) => b.amountCents - a.amountCents);
	return result;
}

export interface DailySpendingRow {
	dateMs: number;
	amountCents: number;
}

export async function computeDailySpending(
	db: Db,
	userId: string,
	periodMonth: string,
	monthStartDay: number,
	timezone: string
): Promise<DailySpendingRow[]> {
	const cycle = getCycleForPeriod(periodMonth, monthStartDay, timezone);
	const fromMs = cycle.start.getTime();
	const toMs = cycle.end.getTime() - 1;

	const txRows = await db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.userId, userId),
				eq(transactions.kind, 'expense'),
				between(transactions.occurredAt, fromMs, toMs)
			)
		);

	// Build one bucket per local day in the cycle. dateMs is the UTC instant of
	// the local Y-M-D so the chart's getUTCDate() formatter shows the user's day.
	const DAY_MS = 86_400_000;
	const startZ = getZonedYearMonthDay(cycle.start, timezone);
	const endZ = getZonedYearMonthDay(new Date(toMs), timezone);
	const startKey = Date.UTC(startZ.y, startZ.m - 1, startZ.d);
	const endKey = Date.UTC(endZ.y, endZ.m - 1, endZ.d);

	const buckets: DailySpendingRow[] = [];
	const idxByKey = new Map<number, number>();
	for (let k = startKey; k <= endKey; k += DAY_MS) {
		idxByKey.set(k, buckets.length);
		buckets.push({ dateMs: k, amountCents: 0 });
	}

	for (const t of txRows) {
		const z = getZonedYearMonthDay(new Date(t.occurredAt), timezone);
		const key = Date.UTC(z.y, z.m - 1, z.d);
		const idx = idxByKey.get(key);
		if (idx !== undefined) buckets[idx].amountCents += t.amountCents;
	}

	return buckets;
}

export interface MonthlyIncomeExpenseRow {
	periodMonth: string;
	incomeCents: number;
	expenseCents: number;
}

export async function computeMonthlyIncomeExpense(
	db: Db,
	userId: string,
	monthsBack: number,
	anchorPeriodMonth: string,
	monthStartDay: number,
	timezone: string
): Promise<MonthlyIncomeExpenseRow[]> {
	const { year: anchorY, monthIdx: anchorM } = periodMonthBounds(anchorPeriodMonth);

	const windows: { periodMonth: string; fromMs: number; toMs: number }[] = [];
	for (let i = monthsBack - 1; i >= 0; i--) {
		const date = new Date(Date.UTC(anchorY, anchorM - i, 1));
		const y = date.getUTCFullYear();
		const mi = date.getUTCMonth();
		const pm = formatPeriodMonth(y, mi);
		const c = getCycleForPeriod(pm, monthStartDay, timezone);
		windows.push({
			periodMonth: pm,
			fromMs: c.start.getTime(),
			toMs: c.end.getTime() - 1
		});
	}

	const earliest = windows[0].fromMs;
	const latest = windows[windows.length - 1].toMs;

	const txRows = await db
		.select()
		.from(transactions)
		.where(
			and(eq(transactions.userId, userId), between(transactions.occurredAt, earliest, latest))
		);

	const result: MonthlyIncomeExpenseRow[] = windows.map((w) => ({
		periodMonth: w.periodMonth,
		incomeCents: 0,
		expenseCents: 0
	}));

	for (const t of txRows) {
		// Find which window this tx falls into
		let idx = -1;
		for (let i = 0; i < windows.length; i++) {
			if (t.occurredAt >= windows[i].fromMs && t.occurredAt <= windows[i].toMs) {
				idx = i;
				break;
			}
		}
		if (idx === -1) continue;
		if (t.kind === 'income') result[idx].incomeCents += t.amountCents;
		else if (t.kind === 'expense') result[idx].expenseCents += t.amountCents;
	}

	return result;
}
