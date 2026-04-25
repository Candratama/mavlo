import { and, between, eq, isNotNull, type SQL } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

const periodMonthBounds = (periodMonth: string): { fromMs: number; toMs: number } => {
	const [yStr, mStr] = periodMonth.split('-');
	const y = Number(yStr);
	const m = Number(mStr) - 1;
	return {
		fromMs: Date.UTC(y, m, 1),
		toMs: Date.UTC(y, m + 1, 1) - 1
	};
};

/**
 * Returns Map<categoryId, spentCents>. Sums expense transactions in `periodMonth`
 * (UTC YYYY-MM) for `userId`, grouped by `categoryId`. Excludes income, transfers,
 * and rows without a categoryId.
 */
export async function computeBudgetSpent(
	db: Db,
	userId: string,
	periodMonth: string
): Promise<Map<string, number>> {
	const { fromMs, toMs } = periodMonthBounds(periodMonth);

	const conds: SQL[] = [
		eq(transactions.userId, userId),
		eq(transactions.kind, 'expense'),
		isNotNull(transactions.categoryId),
		between(transactions.occurredAt, fromMs, toMs)
	];

	const rows = await db.select().from(transactions).where(and(...conds));

	const map = new Map<string, number>();
	for (const r of rows) {
		if (!r.categoryId) continue;
		map.set(r.categoryId, (map.get(r.categoryId) ?? 0) + r.amountCents);
	}
	return map;
}
