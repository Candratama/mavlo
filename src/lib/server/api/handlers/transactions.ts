import {
	transactionCreateSchema,
	transactionUpdateSchema,
	transactionListFilterSchema
} from '$lib/validation/transaction';
import * as repo from '$lib/server/repositories/transactions';
import { applyTransactionRules } from '$lib/server/repositories/transaction-rules';
import { ApiError } from '../errors';
import { type Db, firstIssue } from './shared';

export async function listTx(db: Db, userId: string, url: URL) {
	const parsed = transactionListFilterSchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.listTransactions(db, userId, parsed.data);
}

export async function createTx(db: Db, userId: string, body: unknown) {
	const parsed = transactionCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const input = await applyTransactionRules(db, userId, parsed.data);
	return repo.createTransaction(db, userId, input);
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
	if (!(await repo.getTransaction(db, userId, id))) {
		throw new ApiError(404, 'not_found', 'Transaction not found');
	}
	const input = await applyTransactionRules(db, userId, parsed.data, id);
	const row = await repo.updateTransaction(db, userId, input);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
	return row;
}

export async function deleteTx(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteTransaction(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Transaction not found');
}
