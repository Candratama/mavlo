import { and, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { debts } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';
import { nextDueDate } from '$lib/utils/debt';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export type DebtTotals = {
	// Money user owes (liabilities)
	totalBalanceCents: number;
	totalMinPaymentCents: number;
	// Money owed to user (receivables)
	totalReceivableCents: number;
	upcomingPayments: Array<{
		debtId: string;
		debtName: string;
		dueMs: number;
		minAmountCents: number;
	}>;
};

const DAY_MS = 86_400_000;

export async function computeDebtTotals(
	db: Db,
	userId: string,
	nowMs: number = Date.now()
): Promise<DebtTotals> {
	const rows = await db
		.select()
		.from(debts)
		.where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

	let totalBalanceCents = 0;
	let totalMinPaymentCents = 0;
	let totalReceivableCents = 0;
	const upcomingPayments: DebtTotals['upcomingPayments'] = [];

	for (const r of rows) {
		if (r.direction === 'lent') {
			totalReceivableCents += r.currentBalanceCents;
			continue;
		}
		totalBalanceCents += r.currentBalanceCents;
		totalMinPaymentCents += r.minimumPaymentCents;
		if (r.dueDay) {
			const dueMs = nextDueDate(r.dueDay, nowMs);
			if (dueMs - nowMs <= 30 * DAY_MS) {
				upcomingPayments.push({
					debtId: r.id,
					debtName: r.name,
					dueMs,
					minAmountCents: r.minimumPaymentCents
				});
			}
		}
	}

	upcomingPayments.sort((a, b) => a.dueMs - b.dueMs);

	return { totalBalanceCents, totalMinPaymentCents, totalReceivableCents, upcomingPayments };
}
