import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { categoryCreateSchema, categoryUpdateSchema } from '$lib/validation/category';
import * as repo from '$lib/server/repositories/categories';
import { ApiError } from '../errors';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

function firstIssue(err: { issues: { message: string }[] }): string {
	return err.issues[0]?.message ?? 'Invalid input';
}

export async function listCat(db: Db, userId: string, url: URL) {
	const includeArchived = url.searchParams.get('includeArchived') === 'true';
	return repo.listCategories(db, userId, { includeArchived });
}

export async function createCat(db: Db, userId: string, body: unknown) {
	const parsed = categoryCreateSchema.safeParse(body);
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	return repo.createCategory(db, userId, parsed.data);
}

export async function getCat(db: Db, userId: string, id: string) {
	const row = await repo.getCategory(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Category not found');
	return row;
}

export async function updateCat(db: Db, userId: string, id: string, body: unknown) {
	const parsed = categoryUpdateSchema.safeParse({
		...(typeof body === 'object' && body !== null ? body : {}),
		id
	});
	if (!parsed.success) throw new ApiError(400, 'validation', firstIssue(parsed.error));
	const row = await repo.updateCategory(db, userId, parsed.data);
	if (!row) throw new ApiError(404, 'not_found', 'Category not found');
	return row;
}

export async function deleteCat(db: Db, userId: string, id: string): Promise<void> {
	const row = await repo.deleteCategory(db, userId, id);
	if (!row) throw new ApiError(404, 'not_found', 'Category not found');
}
