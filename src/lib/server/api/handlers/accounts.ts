import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { accountCreateSchema, accountUpdateSchema } from '$lib/validation/account';
import * as repo from '$lib/server/repositories/accounts';
import { computeAccountBalances } from '$lib/server/repositories/balances';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;
type Account = NonNullable<Awaited<ReturnType<typeof repo.getAccount>>>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

/** Attach the live balance (initial + transactions) so agents don't have to compute it. */
function withBalance<T extends Account>(row: T, balanceCents: number) {
	return { ...row, currentBalanceCents: balanceCents };
}

export async function listAcc(db: Db, userId: string, url: URL) {
	const includeArchived = url.searchParams.get('includeArchived') === 'true';
	const [rows, balances] = await Promise.all([
		repo.listAccounts(db, userId, { includeArchived }),
		computeAccountBalances(db, userId)
	]);
	return rows.map((r) => withBalance(r, balances.get(r.id) ?? r.initialBalanceCents));
}

export async function createAcc(db: Db, userId: string, body: unknown) {
	const parsed = accountCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.createAccount(db, userId, parsed.data);
	// Freshly created → no transactions yet, so balance equals the initial balance.
	return withBalance(row, row.initialBalanceCents);
}

export async function getAcc(db: Db, userId: string, id: string) {
	const row = await repo.getAccount(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
	const balances = await computeAccountBalances(db, userId);
	return withBalance(row, balances.get(row.id) ?? row.initialBalanceCents);
}

export async function updateAcc(db: Db, userId: string, id: string, body: unknown) {
	const parsed = accountUpdateSchema.safeParse({
		...(typeof body === 'object' && body !== null ? body : {}),
		id
	});
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateAccount(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
	const balances = await computeAccountBalances(db, userId);
	return withBalance(row, balances.get(row.id) ?? row.initialBalanceCents);
}

export async function deleteAcc(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteAccount(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
}
