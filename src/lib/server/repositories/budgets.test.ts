import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listBudgets, createBudget, updateBudget, deleteBudget, getBudget } from './budgets';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['categories', 'budgets'] });
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

describe('budget target validation', () => {
	beforeEach(() => {
		const now = Date.now();
		h.sqlite
			.prepare(
				'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
			)
			.run('cat-income', h.userId, 'Salary', 'income', now, now);
		h.sqlite
			.prepare(
				'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
			)
			.run('cat2', h.userId, 'Transport', 'expense', now, now);
	});

	const input = { categoryId: 'cat1', periodMonth: '2026-10', limitCents: 1000 };

	it("rejects another user's category", async () => {
		await expect(
			createBudget(h.db, h.userId, { ...input, categoryId: 'cat-other' })
		).rejects.toMatchObject({ message: 'Category not found', conflict: false });
	});

	it('rejects a category that does not exist', async () => {
		await expect(createBudget(h.db, h.userId, { ...input, categoryId: 'nope' })).rejects.toThrow(
			'Category not found'
		);
	});

	it('rejects an income category', async () => {
		await expect(
			createBudget(h.db, h.userId, { ...input, categoryId: 'cat-income' })
		).rejects.toThrow('Budgets require an expense category');
	});

	it('rejects a second budget for the same category and period as a conflict', async () => {
		await createBudget(h.db, h.userId, input);
		await expect(createBudget(h.db, h.userId, input)).rejects.toMatchObject({ conflict: true });
		expect(await listBudgets(h.db, h.userId, {})).toHaveLength(1);
	});

	it('allows the same category in another period', async () => {
		await createBudget(h.db, h.userId, input);
		await createBudget(h.db, h.userId, { ...input, periodMonth: '2026-11' });
		expect(await listBudgets(h.db, h.userId, {})).toHaveLength(2);
	});

	it('rejects an update that would duplicate another budget', async () => {
		await createBudget(h.db, h.userId, input);
		const b = await createBudget(h.db, h.userId, { ...input, categoryId: 'cat2' });
		await expect(
			updateBudget(h.db, h.userId, { ...input, id: b.id, categoryId: 'cat1' })
		).rejects.toMatchObject({ conflict: true });
	});

	it('lets a budget be saved over itself (no self-conflict)', async () => {
		const b = await createBudget(h.db, h.userId, input);
		const updated = await updateBudget(h.db, h.userId, { ...input, id: b.id, limitCents: 2000 });
		expect(updated?.limitCents).toBe(2000);
	});

	it('keeps a pre-existing duplicate editable when category and period are unchanged', async () => {
		const now = Date.now();
		const insert = h.sqlite.prepare(
			'INSERT INTO budgets (id, user_id, category_id, period_month, limit_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		insert.run('dup1', h.userId, 'cat1', '2026-10', 1000, now, now);
		insert.run('dup2', h.userId, 'cat1', '2026-10', 1000, now, now);
		const updated = await updateBudget(h.db, h.userId, { ...input, id: 'dup2', limitCents: 5 });
		expect(updated?.limitCents).toBe(5);
	});
});
