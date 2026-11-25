import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import type { TransactionCreateInput } from '$lib/validation/transaction';
import { getAccount } from './accounts';
import { computeAccountBalances } from './balances';
import { ensureDebtPaymentCategory, ensureLoanCollectedCategory } from './categories';
import { getDebt } from './debts';
import { getTransaction } from './transactions';
import { RepoValidationError } from './errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

/**
 * Business rules every transaction write must pass, whether it comes from the
 * app's forms or the external API. Returns the input to store (a debt-linked
 * transaction without a category gets the matching system category). Throws
 * RepoValidationError.
 *
 * `updatingId` is the transaction being edited: its old amount is credited back
 * to the balance check when it drew from the same account.
 */
export async function applyTransactionRules<T extends TransactionCreateInput>(
	db: Db,
	userId: string,
	input: T,
	updatingId?: string
): Promise<T> {
	const source = await getAccount(db, userId, input.accountId);
	if (!source) throw new RepoValidationError('Source account not found');
	if (source.type === 'savings' && (input.kind === 'income' || input.kind === 'expense')) {
		throw new RepoValidationError('Savings accounts only support transfers, not income/expense');
	}

	if (input.kind === 'expense' || input.kind === 'transfer') {
		const balances = await computeAccountBalances(db, userId);
		let available = balances.get(input.accountId) ?? 0;
		const old = updatingId ? await getTransaction(db, userId, updatingId) : null;
		if (old && old.accountId === input.accountId) {
			if (old.kind === 'expense' || old.kind === 'transfer') available += old.amountCents;
			else if (old.kind === 'income') available -= old.amountCents;
		}
		if (input.amountCents > available) {
			throw new RepoValidationError('Insufficient balance in source account');
		}
	}

	if (input.debtId && !input.categoryId) {
		const debt = await getDebt(db, userId, input.debtId);
		if (debt?.direction === 'lent' && input.kind === 'income') {
			return { ...input, categoryId: await ensureLoanCollectedCategory(db, userId) };
		}
		if (debt?.direction === 'borrowed' && input.kind === 'expense') {
			return { ...input, categoryId: await ensureDebtPaymentCategory(db, userId) };
		}
	}
	return input;
}
