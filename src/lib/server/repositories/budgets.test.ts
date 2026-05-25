import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listBudgets, createBudget, updateBudget, deleteBudget, getBudget } from './budgets';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['categories', 'budgets'] });
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
		.run('cat1', h.userId, 'Food', 'expense', now, now);
	h.sqlite
		.prepare('INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
		.run('cat-other', h.otherUserId, 'Other', 'expense', now, now);
});

describe('budgets repository', () => {
	it('createBudget + listBudgets returns own', async () => {
		await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 500000
		});
		await createBudget(h.db, h.otherUserId, {
			categoryId: 'cat-other',
			periodMonth: '2026-04',
			limitCents: 100000
		});

		const list = await listBudgets(h.db, h.userId, { periodMonth: '2026-04' });
		expect(list).toHaveLength(1);
		expect(list[0].limitCents).toBe(500000);
	});

	it('listBudgets filters by periodMonth', async () => {
		await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 100
		});
		await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-05',
			limitCents: 200
		});
		expect(await listBudgets(h.db, h.userId, { periodMonth: '2026-04' })).toHaveLength(1);
		expect(await listBudgets(h.db, h.userId, { periodMonth: '2026-05' })).toHaveLength(1);
	});

	it('updateBudget cross-user returns null', async () => {
		const b = await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 100
		});
		expect(
			await updateBudget(h.db, h.otherUserId, {
				id: b.id,
				categoryId: 'cat1',
				periodMonth: '2026-04',
				limitCents: 999
			})
		).toBeNull();
	});

	it('deleteBudget works for own; cross-user returns null', async () => {
		const b = await createBudget(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-04',
			limitCents: 100
		});
		expect(await deleteBudget(h.db, h.otherUserId, b.id)).toBeNull();
		expect(await deleteBudget(h.db, h.userId, b.id)).not.toBeNull();
		expect(await getBudget(h.db, h.userId, b.id)).toBeNull();
	});
});
