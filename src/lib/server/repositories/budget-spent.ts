import { and, between, eq, isNotNull, type SQL } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

/**
 * Returns Map<categoryId, spentCents>. Sums expense transactions in the given
 * time range [fromMs, toMs] for `userId`, grouped by `categoryId`. Excludes
 * income, transfers, and rows without a categoryId.
 */
export async function computeBudgetSpent(
	db: Db,
	userId: string,
	fromMs: number,
	toMs: number
): Promise<Map<string, number>> {
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
