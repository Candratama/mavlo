import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionListFilterSchema
} from '$lib/validation/transaction';
import * as repo from '$lib/server/repositories/transactions';
import { getAccount } from '$lib/server/repositories/accounts';
import { getCategory } from '$lib/server/repositories/categories';
import { getDebt } from '$lib/server/repositories/debts';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

/**
 * Reject referenced ids that don't belong to this user. FK constraints only enforce
 * existence, so without this a caller could point a transaction at another user's
 * account, category, or debt.
 */
async function assertRefsOwned(
	db: Db,
	userId: string,
	refs: { accountId: string; transferToAccountId?: string; categoryId?: string; debtId?: string }
) {
	if (!(await getAccount(db, userId, refs.accountId))) {
		throw new ApiError(400, 'validation', 'Account not found');
	}
	if (refs.transferToAccountId && !(await getAccount(db, userId, refs.transferToAccountId))) {
		throw new ApiError(400, 'validation', 'Destination account not found');
	}
	if (refs.categoryId && !(await getCategory(db, userId, refs.categoryId))) {
		throw new ApiError(400, 'validation', 'Category not found');
	}
	if (refs.debtId && !(await getDebt(db, userId, refs.debtId))) {
		throw new ApiError(400, 'validation', 'Debt not found');
	}
}

export async function listTx(db: Db, userId: string, url: URL) {
	const parsed = transactionListFilterSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.listTransactions(db, userId, parsed.data);
}

export async function createTx(db: Db, userId: string, body: unknown) {
	const parsed = transactionCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	await assertRefsOwned(db, userId, parsed.data);
	return repo.createTransaction(db, userId, parsed.data);
}

export async function getTx(db: Db, userId: string, id: string) {
	const row = await repo.getTransaction(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
	return row;
}

export async function updateTx(db: Db, userId: string, id: string, body: unknown) {
	const parsed = transactionUpdateSchema.safeParse({
		...(typeof body === 'object' && body !== null ? body : {}),
		id
	});
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	// Confirm ownership of the target row before validating referenced ids, so a caller
	// editing someone else's transaction gets 404 (not a 400 about the refs).
	if (!(await repo.getTransaction(db, userId, id))) {
		throw new ApiError(404, 'not_found', 'Transaction not found');
	}
	await assertRefsOwned(db, userId, parsed.data);
	const row = await repo.updateTransaction(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
	return row;
}

export async function deleteTx(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteTransaction(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
}
