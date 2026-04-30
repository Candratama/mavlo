import { and, between, desc, eq, type SQL } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { transactions } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type {
	TransactionCreateInput,
	TransactionUpdateInput,
	TransactionListFilter
} from '$lib/validation/transaction';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

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
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt
		})
		.returning();
	return row;
}

export async function updateTransaction(db: Db, userId: string, input: TransactionUpdateInput) {
	const [row] = await db
		.update(transactions)
		.set({
			accountId: input.accountId,
			categoryId: input.categoryId ?? null,
			transferToAccountId: input.transferToAccountId ?? null,
			amountCents: input.amountCents,
			kind: input.kind,
			note: input.note ?? null,
			occurredAt: input.occurredAt,
			updatedAt: Date.now()
		})
		.where(and(eq(transactions.userId, userId), eq(transactions.id, input.id)))
		.returning();
	return row ?? null;
}

export async function deleteTransaction(db: Db, userId: string, id: string) {
	const [row] = await db
		.delete(transactions)
		.where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
		.returning();
	return row ?? null;
}
