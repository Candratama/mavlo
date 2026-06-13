import { and, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { accounts, debts } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import type { DebtCreateInput, DebtUpdateInput } from '$lib/validation/debt';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export type DebtRow = typeof debts.$inferSelect;
export type RepoError = { error: string };

export async function listDebts(
	db: Db,
	userId: string,
	filter: {
		status?: 'active' | 'paid_off' | 'in_arrears';
		direction?: 'borrowed' | 'lent';
	}
): Promise<DebtRow[]> {
	const conds = [eq(debts.userId, userId)];
	if (filter.status) conds.push(eq(debts.status, filter.status));
	if (filter.direction) conds.push(eq(debts.direction, filter.direction));
	return db
		.select()
		.from(debts)
		.where(and(...conds));
}

export async function getDebt(db: Db, userId: string, id: string): Promise<DebtRow | null> {
	const [row] = await db
		.select()
		.from(debts)
		.where(and(eq(debts.userId, userId), eq(debts.id, id)))
		.limit(1);
	return row ?? null;
}

async function validateAccountLink(
	db: Db,
	userId: string,
	accountId: string | null | undefined,
	debtType: string,
	direction: 'borrowed' | 'lent'
): Promise<RepoError | null> {
	if (!accountId) return null;
	const [acc] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
		.limit(1);
	if (!acc) return { error: 'Account not found' };
	// Credit-type constraint only applies to user's own credit card debts.
	if (direction === 'borrowed' && debtType === 'credit_card' && acc.type !== 'credit') {
		return { error: 'Linked account must be credit-type for a credit card debt' };
	}
	return null;
}

export async function createDebt(
	db: Db,
	userId: string,
	input: DebtCreateInput
): Promise<DebtRow | RepoError> {
	const err = await validateAccountLink(
		db,
		userId,
		input.accountId,
		input.type,
		input.direction ?? 'borrowed'
	);
	if (err) return err;
	const [row] = await db
		.insert(debts)
		.values({
			userId,
			name: input.name,
			type: input.type,
			lender: input.lender ?? null,
			principalCents: input.principalCents,
			currentBalanceCents: input.currentBalanceCents,
			interestRatePct: input.interestRatePct,
			minimumPaymentCents: input.minimumPaymentCents,
			dueDay: input.dueDay ?? null,
			startDate: input.startDate,
			maturityDate: input.maturityDate ?? null,
			accountId: input.accountId ?? null,
			direction: input.direction ?? 'borrowed',
			note: input.note ?? null
		})
		.returning();
	return row;
}

export async function updateDebt(
	db: Db,
	userId: string,
	input: DebtUpdateInput
): Promise<DebtRow | RepoError> {
	const existing = await getDebt(db, userId, input.id);
	if (!existing) return { error: 'Debt not found' };
	const err = await validateAccountLink(
		db,
		userId,
		input.accountId,
		input.type,
		input.direction ?? existing.direction
	);
	if (err) return err;
	const [row] = await db
		.update(debts)
		.set({
			name: input.name,
			type: input.type,
			lender: input.lender ?? null,
			principalCents: input.principalCents,
			currentBalanceCents: input.currentBalanceCents,
			interestRatePct: input.interestRatePct,
			minimumPaymentCents: input.minimumPaymentCents,
			dueDay: input.dueDay ?? null,
			startDate: input.startDate,
			maturityDate: input.maturityDate ?? null,
			accountId: input.accountId ?? null,
			direction: input.direction ?? existing.direction,
			status: input.status ?? existing.status,
			note: input.note ?? null,
			updatedAt: Date.now()
		})
		.where(and(eq(debts.userId, userId), eq(debts.id, input.id)))
		.returning();
	return row ?? { error: 'Debt not found' };
}

export async function deleteDebt(db: Db, userId: string, id: string): Promise<DebtRow | null> {
	const [row] = await db
		.delete(debts)
		.where(and(eq(debts.userId, userId), eq(debts.id, id)))
		.returning();
	return row ?? null;
}

export async function markDebtPaidOff(db: Db, userId: string, id: string): Promise<DebtRow | null> {
	const [row] = await db
		.update(debts)
		.set({ status: 'paid_off', currentBalanceCents: 0, updatedAt: Date.now() })
		.where(and(eq(debts.userId, userId), eq(debts.id, id)))
		.returning();
	return row ?? null;
}
