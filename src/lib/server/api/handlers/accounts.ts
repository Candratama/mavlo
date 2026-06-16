import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { accountCreateSchema, accountUpdateSchema } from '$lib/validation/account';
import * as repo from '$lib/server/repositories/accounts';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

export async function listAcc(db: Db, userId: string, url: URL) {
	const includeArchived = url.searchParams.get('includeArchived') === 'true';
	return repo.listAccounts(db, userId, { includeArchived });
}

export async function createAcc(db: Db, userId: string, body: unknown) {
	const parsed = accountCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.createAccount(db, userId, parsed.data);
}

export async function getAcc(db: Db, userId: string, id: string) {
	const row = await repo.getAccount(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
	return row;
}

export async function updateAcc(db: Db, userId: string, id: string, body: unknown) {
	const parsed = accountUpdateSchema.safeParse({ ...(body as object), id });
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateAccount(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
	return row;
}

export async function deleteAcc(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteAccount(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Account not found');
}
