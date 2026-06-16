import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionListFilterSchema
} from '$lib/validation/transaction';
import * as repo from '$lib/server/repositories/transactions';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

export async function listTx(db: Db, userId: string, url: URL) {
	const parsed = transactionListFilterSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.listTransactions(db, userId, parsed.data);
}

export async function createTx(db: Db, userId: string, body: unknown) {
	const parsed = transactionCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.createTransaction(db, userId, parsed.data);
}

export async function getTx(db: Db, userId: string, id: string) {
	const row = await repo.getTransaction(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
	return row;
}

export async function updateTx(db: Db, userId: string, id: string, body: unknown) {
	const parsed = transactionUpdateSchema.safeParse({ ...(body as object), id });
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateTransaction(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
	return row;
}

export async function deleteTx(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteTransaction(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
}
