import { and, between, desc, eq, type SQL } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { transactions, debts } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type {
	TransactionCreateInput,
	TransactionUpdateInput,
	TransactionListFilter
} from '$lib/validation/transaction';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

/**
 * Returns true when this tx kind should reduce the given debt's balance:
 *  - borrowed + expense = repayment
 *  - lent + income = collection
 */
function txReducesDebtBalance(
	debtDirection: 'borrowed' | 'lent',
	txKind: 'income' | 'expense' | 'transfer'
): boolean {
	if (debtDirection === 'borrowed' && txKind === 'expense') return true;
	if (debtDirection === 'lent' && txKind === 'income') return true;
	return false;
}

async function applyDebtPayment(
	db: Db,
	userId: string,
	debtId: string,
	txKind: 'income' | 'expense' | 'transfer',
	deltaCents: number
) {
	// deltaCents positive = pay down (reduce balance), negative = restore
	const [debt] = await db
		.select()
		.from(debts)
		.where(and(eq(debts.userId, userId), eq(debts.id, debtId)))
		.limit(1);
	if (!debt) return;
	if (!txReducesDebtBalance(debt.direction, txKind)) return;
	const newBalance = Math.max(0, debt.currentBalanceCents - deltaCents);
	// Any fully-paid debt becomes paid_off (including in_arrears); a pay-down
	// on an in_arrears debt clears it back to active, as the UI promises.
	let newStatus = debt.status;
	if (newBalance === 0) newStatus = 'paid_off';
	else if (debt.status === 'paid_off') newStatus = 'active';
	else if (debt.status === 'in_arrears' && deltaCents > 0) newStatus = 'active';
	await db
		.update(debts)
		.set({ currentBalanceCents: newBalance, status: newStatus, updatedAt: Date.now() })
		.where(and(eq(debts.userId, userId), eq(debts.id, debtId)));
}

export async function listTransactions(db: Db, userId: string, filter: TransactionListFilter) {
	const conds: SQL[] = [eq(transactions.userId, userId)];
	if (filter.fromMs !== undefined && filter.toMs !== undefined) {
		conds.push(between(transactions.occurredAt, filter.fromMs, filter.toMs));
	}
	if (filter.accountId) conds.push(eq(transactions.accountId, filter.accountId));
	if (filter.categoryId) conds.push(eq(transactions.categoryId, filter.categoryId));
	if (filter.kind) conds.push(eq(transactions.kind, filter.kind));

	return db
		.select()
		.from(transactions)
		.where(and(...conds))
		.orderBy(desc(transactions.occurredAt), desc(transactions.createdAt));
}

export async function getTransaction(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(transactions)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.limit(1);
	return row ?? null;
}

export async function createTransaction(db: Db, userId: string, input: TransactionCreateInput) {
	const [row] = await db
		.insert(transactions)
		.values({
			userId,
			accountId: input.accountId,
			categoryId: input.categoryId ?? null,
			transferToAccountId: input.transferToAccountId ?? null,
			debtId: input.debtId ?? null,
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt
		})
		.returning();
	if (row.debtId) {
		await applyDebtPayment(db, userId, row.debtId, row.kind, row.amountCents);
	}
	return row;
}

export async function updateTransaction(db: Db, userId: string, input: TransactionUpdateInput) {
	const existing = await getTransaction(db, userId, input.id);
	const [row] = await db
		.update(transactions)
		.set({
			accountId: input.accountId,
			categoryId: input.categoryId ?? null,
			transferToAccountId: input.transferToAccountId ?? null,
			debtId: input.debtId ?? null,
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt,
			updatedAt: Date.now()
		})
		.where(and(eq(transactions.userId, userId), eq(transactions.id, input.id)))
		.returning();
	if (!row) return null;
	// Reverse old debt effect
	if (existing && existing.debtId) {
		await applyDebtPayment(db, userId, existing.debtId, existing.kind, -existing.amountCents);
	}
	// Apply new debt effect
	if (input.debtId) {
		await applyDebtPayment(db, userId, input.debtId, input.kind, input.amountCents);
	}
	return row;
}

export async function deleteTransaction(db: Db, userId: string, id: string) {
	const existing = await getTransaction(db, userId, id);
	const [row] = await db
		.delete(transactions)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.returning();
	if (row && existing && existing.debtId) {
		await applyDebtPayment(db, userId, existing.debtId, existing.kind, -existing.amountCents);
	}
	return row ?? null;
}
