import { eq, sql } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { accounts, transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

export type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

// Narrow to the concrete SQLite type for query building — D1 and better-sqlite3
// share the same SQLite dialect, so the generated SQL is identical at runtime.
type SqliteDb = BetterSQLite3Database<typeof schema>;

/**
 * Returns Map<accountId, balanceCents>. Includes only accounts owned by `userId`.
 * Balance = initial_balance_cents + SUM(income) - SUM(expense). Computed in SQL.
 */
export async function computeAccountBalances(
	db: Db,
	userId: string
): Promise<Map<string, number>> {
	const rows = await (db as SqliteDb)
		.select({
			id: accounts.id,
			initialBalanceCents: accounts.initialBalanceCents,
			incomeCents: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'income' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
			expenseCents: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`
		})
		.from(accounts)
		.leftJoin(
			transactions,
			sql`${transactions.accountId} = ${accounts.id} AND ${transactions.userId} = ${userId}`
		)
		.where(eq(accounts.userId, userId))
		.groupBy(accounts.id);

	const map = new Map<string, number>();
	for (const r of rows) {
		map.set(r.id, r.initialBalanceCents + r.incomeCents - r.expenseCents);
	}
	return map;
}
