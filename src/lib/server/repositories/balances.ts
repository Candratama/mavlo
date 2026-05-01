import { and, between, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { accounts, transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export interface AccountPeriodSummary {
	incomeCents: number;
	expenseCents: number;
}

/**
 * Returns Map<accountId, {incomeCents, expenseCents}> for transactions in [fromMs, toMs].
 *
 * Per-account flow view (NOT strict accounting):
 *   - income kind  → +income on source account
 *   - expense kind → +expense on source account
 *   - transfer     → +expense on source account, +income on target account
 *
 * This represents money in/out of each account, useful for per-account dashboards.
 * Range is inclusive.
 */
export async function computeAccountPeriodSummary(
	db: Db,
	userId: string,
	fromMs: number,
	toMs: number
): Promise<Map<string, AccountPeriodSummary>> {
	const rows = await db
		.select()
		.from(transactions)
		.where(and(eq(transactions.userId, userId), between(transactions.occurredAt, fromMs, toMs)));

	const out = new Map<string, AccountPeriodSummary>();
	const bump = (accountId: string, key: 'incomeCents' | 'expenseCents', cents: number) => {
		const cur = out.get(accountId) ?? { incomeCents: 0, expenseCents: 0 };
		cur[key] += cents;
		out.set(accountId, cur);
	};

	for (const t of rows) {
		if (t.kind === 'income') {
			bump(t.accountId, 'incomeCents', t.amountCents);
		} else if (t.kind === 'expense') {
			bump(t.accountId, 'expenseCents', t.amountCents);
		} else if (t.kind === 'transfer') {
			bump(t.accountId, 'expenseCents', t.amountCents);
			if (t.transferToAccountId) {
				bump(t.transferToAccountId, 'incomeCents', t.amountCents);
			}
		}
	}
	return out;
}

/**
 * Returns Map<accountId, balanceCents>. Includes only accounts owned by `userId`.
 *
 * Per account: balance = initial_balance_cents
 *   + SUM(income.amount   WHERE account_id = this)
 *   - SUM(expense.amount  WHERE account_id = this)
 *   - SUM(transfer.amount WHERE account_id = this)             // outgoing
 *   + SUM(transfer.amount WHERE transfer_to_account_id = this) // incoming
 *
 * Computed via JS fold over all user transactions (handles transfer's dual-account effect cleanly).
 * For typical personal-finance scale (<10k rows/user) the load-all cost is negligible.
 */
export async function computeAccountBalances(db: Db, userId: string): Promise<Map<string, number>> {
	const ownedAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
	const ownTransactions = await db
		.select()
		.from(transactions)
		.where(eq(transactions.userId, userId));

	const balances = new Map<string, number>();
	for (const a of ownedAccounts) {
		balances.set(a.id, a.initialBalanceCents);
	}

	for (const t of ownTransactions) {
		// Skip if the source account isn't in our owned set (defensive; should never happen).
		if (!balances.has(t.accountId)) continue;

		if (t.kind === 'income') {
			balances.set(t.accountId, balances.get(t.accountId)! + t.amountCents);
		} else if (t.kind === 'expense') {
			balances.set(t.accountId, balances.get(t.accountId)! - t.amountCents);
		} else if (t.kind === 'transfer' && t.transferToAccountId) {
			balances.set(t.accountId, balances.get(t.accountId)! - t.amountCents);
			if (balances.has(t.transferToAccountId)) {
				balances.set(t.transferToAccountId, balances.get(t.transferToAccountId)! + t.amountCents);
			}
		}
	}

	return balances;
}
