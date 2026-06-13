import { and, eq } from 'drizzle-orm';
import { type DrizzleD1Database } from 'drizzle-orm/d1';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { budgetSubsidies } from '$lib/server/db/schema';
import * as schema from '$lib/server/db/schema';

type Db = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>;

export type SubsidyFlowMap = Map<string, { in: number; out: number }>;

export async function computeSubsidyFlows(
	db: Db,
	userId: string,
	periodMonth: string
): Promise<SubsidyFlowMap> {
	const rows = await db
		.select()
		.from(budgetSubsidies)
		.where(and(eq(budgetSubsidies.userId, userId), eq(budgetSubsidies.periodMonth, periodMonth)));

	const map: SubsidyFlowMap = new Map();
	const bump = (id: string, key: 'in' | 'out', amount: number) => {
		const cur = map.get(id) ?? { in: 0, out: 0 };
		cur[key] += amount;
		map.set(id, cur);
	};
	for (const r of rows) {
		bump(r.fromBudgetId, 'out', r.amountCents);
		bump(r.toBudgetId, 'in', r.amountCents);
	}
	return map;
}
