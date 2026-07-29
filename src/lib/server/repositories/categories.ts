import { and, asc, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { categories } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import { SYSTEM_CATEGORY_KEYS } from '$lib/utils/system-categories';
import type { CategoryCreateInput, CategoryUpdateInput } from '$lib/validation/category';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export async function listCategories(db: Db, userId: string, opts: { includeArchived: boolean }) {
	const where = opts.includeArchived
		? eq(categories.userId, userId)
		: and(eq(categories.userId, userId), eq(categories.archived, false));
	return db
		.select()
		.from(categories)
		.where(where)
		.orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.select()
		.from(categories)
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.limit(1);
	return row ?? null;
}

export async function createCategory(db: Db, userId: string, input: CategoryCreateInput) {
	const [row] = await db
		.insert(categories)
		.values({
			userId,
			name: input.name,
			kind: input.kind,
			expenseType: input.kind === 'expense' ? input.expenseType : 'variable',
			color: input.color ?? null,
			icon: input.icon ?? null
		})
		.returning();
	return row;
}

export async function updateCategory(db: Db, userId: string, input: CategoryUpdateInput) {
	const [row] = await db
		.update(categories)
		.set({
			name: input.name,
			kind: input.kind,
			expenseType: input.kind === 'expense' ? input.expenseType : 'variable',
			color: input.color ?? null,
			icon: input.icon ?? null,
			updatedAt: Date.now()
		})
		.where(and(eq(categories.userId, userId), eq(categories.id, input.id)))
		.returning();
	return row ?? null;
}

export async function archiveCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(categories)
		.set({ archived: true, updatedAt: Date.now() })
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.returning();
	return row ?? null;
}

export async function unarchiveCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.update(categories)
		.set({ archived: false, updatedAt: Date.now() })
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.returning();
	return row ?? null;
}

export async function deleteCategory(db: Db, userId: string, id: string) {
	const [row] = await db
		.delete(categories)
		.where(and(eq(categories.userId, userId), eq(categories.id, id)))
		.returning();
	return row ?? null;
}

// Per-kind sortOrder offsets keep expense and income ranges disjoint, so a
// combined picker (ordered by sortOrder) never interleaves the two kinds.
const KIND_SORT_OFFSET: Record<'expense' | 'income', number> = {
	expense: 0,
	income: 100_000
};

export async function reorderCategories(
	db: Db,
	userId: string,
	orderedIds: string[]
): Promise<void> {
	// Renumber the user's ENTIRE category set, not just the ids sent. The client
	// sends one kind (and usually only non-archived rows); categories left out
	// (other kind, archived) keep their relative order after the sent ones so no
	// two categories end up sharing a sortOrder.
	const all = await db
		.select()
		.from(categories)
		.where(eq(categories.userId, userId))
		.orderBy(asc(categories.sortOrder), asc(categories.name));
	const byId = new Map(all.map((c) => [c.id, c]));
	const sentKind = orderedIds.map((id) => byId.get(id)?.kind).find(Boolean);
	if (!sentKind) return;
	const sent = orderedIds
		.map((id) => byId.get(id))
		.filter((c): c is (typeof all)[number] => !!c && c.kind === sentKind);
	const sentIds = new Set(sent.map((c) => c.id));

	const updates: { id: string; sortOrder: number }[] = [];
	for (const kind of ['expense', 'income'] as const) {
		const rest = all.filter((c) => c.kind === kind && !sentIds.has(c.id));
		const ordered = kind === sentKind ? [...sent, ...rest] : rest;
		ordered.forEach((c, idx) => {
			const sortOrder = KIND_SORT_OFFSET[kind] + idx;
			if (c.sortOrder !== sortOrder) updates.push({ id: c.id, sortOrder });
		});
	}
	await Promise.all(
		updates.map((u) =>
			db
				.update(categories)
				.set({ sortOrder: u.sortOrder, updatedAt: Date.now() })
				.where(and(eq(categories.userId, userId), eq(categories.id, u.id)))
		)
	);
}

interface SystemCategorySpec {
	key: string;
	name: string;
	kind: 'income' | 'expense';
	expenseType?: 'fixed' | 'variable';
	icon?: string;
	color?: string;
}

async function ensureSystemCategory(
	db: Db,
	userId: string,
	spec: SystemCategorySpec
): Promise<string> {
	// Match kind as well as key: if the user flipped the category's kind via the
	// edit form, reusing it would attach expense features (budgets, debt
	// payments) to an income category — create a fresh correct-kind one instead.
	const [byKey] = await db
		.select()
		.from(categories)
		.where(
			and(
				eq(categories.userId, userId),
				eq(categories.systemKey, spec.key),
				eq(categories.kind, spec.kind)
			)
		)
		.limit(1);
	if (byKey) return byKey.id;
	// Legacy rows created before system_key existed: adopt by original name and
	// stamp the key so future renames keep working.
	const [legacy] = await db
		.select()
		.from(categories)
		.where(
			and(
				eq(categories.userId, userId),
				eq(categories.name, spec.name),
				eq(categories.kind, spec.kind)
			)
		)
		.limit(1);
	if (legacy) {
		await db
			.update(categories)
			.set({ systemKey: spec.key, updatedAt: Date.now() })
			.where(and(eq(categories.userId, userId), eq(categories.id, legacy.id)));
		return legacy.id;
	}
	const [created] = await db
		.insert(categories)
		.values({
			userId,
			name: spec.name,
			kind: spec.kind,
			expenseType: spec.expenseType ?? 'variable',
			icon: spec.icon ?? null,
			color: spec.color ?? null,
			systemKey: spec.key
		})
		.returning();
	return created.id;
}

export async function ensureDebtPaymentCategory(db: Db, userId: string): Promise<string> {
	return ensureSystemCategory(db, userId, {
		key: SYSTEM_CATEGORY_KEYS.debtPayment,
		name: 'Debt Payment',
		kind: 'expense',
		expenseType: 'fixed',
		icon: 'wallet'
	});
}

export async function ensureMoneyLentOutCategory(db: Db, userId: string): Promise<string> {
	return ensureSystemCategory(db, userId, {
		key: SYSTEM_CATEGORY_KEYS.moneyLentOut,
		name: 'Money Lent Out',
		kind: 'expense',
		icon: 'arrow-up-right',
		color: '#f59e0b'
	});
}

export async function ensureLoanCollectedCategory(db: Db, userId: string): Promise<string> {
	return ensureSystemCategory(db, userId, {
		key: SYSTEM_CATEGORY_KEYS.loanCollected,
		name: 'Loan Collected',
		kind: 'income',
		icon: 'arrow-down-left',
		color: '#10b981'
	});
}

export async function ensureLoanProceedsCategory(db: Db, userId: string): Promise<string> {
	return ensureSystemCategory(db, userId, {
		key: SYSTEM_CATEGORY_KEYS.loanProceeds,
		name: 'Loan Proceeds',
		kind: 'income',
		icon: 'banknote',
		color: '#10b981'
	});
}

export async function getOrCreateAdjustmentCategory(
	db: Db,
	userId: string,
	kind: 'income' | 'expense'
): Promise<string> {
	return ensureSystemCategory(db, userId, {
		key:
			kind === 'income'
				? SYSTEM_CATEGORY_KEYS.adjustmentIncome
				: SYSTEM_CATEGORY_KEYS.adjustmentExpense,
		name: 'Balance Adjustment',
		kind,
		color: kind === 'income' ? '#10b981' : '#f43f5e',
		icon: kind === 'income' ? 'trending-up' : 'trending-down'
	});
}
