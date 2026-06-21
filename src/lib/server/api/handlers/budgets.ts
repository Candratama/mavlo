import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { budgetCreateSchema, budgetUpdateSchema } from '$lib/validation/budget';
import * as repo from '$lib/server/repositories/budgets';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

export async function listBud(db: Db, userId: string, url: URL) {
	const periodMonth = url.searchParams.get('periodMonth') ?? undefined;
	return repo.listBudgets(db, userId, { periodMonth });
}

export async function createBud(db: Db, userId: string, body: unknown) {
	const parsed = budgetCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.createBudget(db, userId, parsed.data);
}

export async function getBud(db: Db, userId: string, id: string) {
	const row = await repo.getBudget(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Budget not found');
	return row;
}

export async function updateBud(db: Db, userId: string, id: string, body: unknown) {
	const parsed = budgetUpdateSchema.safeParse({
		...(typeof body === 'object' && body !== null ? body : {}),
		id
	});
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateBudget(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Budget not found');
	return row;
}

export async function deleteBud(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteBudget(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Budget not found');
}
