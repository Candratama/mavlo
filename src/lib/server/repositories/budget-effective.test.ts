import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { computeSubsidyFlows } from './budget-effective';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({
		tables: ['categories', 'budgets', 'budget_subsidies']
	});
	const now = Date.now();
	h.sqlite
		.prepare(
			'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
		)
		.run('cat1', h.userId, 'Food', 'expense', now, now);
	h.sqlite
		.prepare(
			'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
		)
		.run('cat2', h.userId, 'Transport', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO budgets VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)')
		.run('b1', h.userId, 'cat1', '2026-04', 1_000_000, now, now);
	h.sqlite
		.prepare('INSERT INTO budgets VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)')
		.run('b2', h.userId, 'cat2', '2026-04', 500_000, now, now);
});

const insertSubsidy = (
	id: string,
	from: string,
	to: string,
	amount: number,
	period = '2026-04',
	userId?: string
) => {
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO budget_subsidies VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)')
		.run(id, userId ?? h.userId, period, from, to, amount, now, now);
};

describe('computeSubsidyFlows', () => {
	it('returns empty map when no subsidies', async () => {
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.size).toBe(0);
	});

	it('records single transfer as out on source, in on target', async () => {
		insertSubsidy('s1', 'b2', 'b1', 200_000);
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.get('b1')).toEqual({ in: 200_000, out: 0 });
		expect(map.get('b2')).toEqual({ in: 0, out: 200_000 });
	});

	it('accumulates multiple subsidies into same target', async () => {
		insertSubsidy('s1', 'b2', 'b1', 100_000);
		insertSubsidy('s2', 'b2', 'b1', 150_000);
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.get('b1')).toEqual({ in: 250_000, out: 0 });
		expect(map.get('b2')).toEqual({ in: 0, out: 250_000 });
	});

	it('filters by period', async () => {
		insertSubsidy('s1', 'b2', 'b1', 100_000, '2026-04');
		insertSubsidy('s2', 'b2', 'b1', 999_000, '2026-05');
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.get('b1')?.in).toBe(100_000);
	});

	it('filters by user', async () => {
		insertSubsidy('s1', 'b2', 'b1', 100_000, '2026-04', h.otherUserId);
		const map = await computeSubsidyFlows(h.db, h.userId, '2026-04');
		expect(map.size).toBe(0);
	});
});
