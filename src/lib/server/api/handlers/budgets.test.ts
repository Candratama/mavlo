import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { createCat } from './categories';
import { listBud, createBud, getBud, updateBud, deleteBud } from './budgets';

let h: TestDbHandle;
let categoryId: string;

beforeEach(async () => {
	h = createTestDb({ tables: ['categories', 'budgets'] });
	const cat = await createCat(h.db, h.userId, { name: 'Food', kind: 'expense' });
	categoryId = cat.id;
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/budgets${qs}`);
}

describe('budgets handler', () => {
	it('createBud + listBud round-trips', async () => {
		const created = await createBud(h.db, h.userId, {
			categoryId,
			periodMonth: '2026-06',
			limitCents: 50000
		});
		expect(created.limitCents).toBe(50000);
		expect(await listBud(h.db, h.userId, url())).toHaveLength(1);
	});

	it('listBud filters by periodMonth', async () => {
		await createBud(h.db, h.userId, { categoryId, periodMonth: '2026-06', limitCents: 50000 });
		await createBud(h.db, h.userId, { categoryId, periodMonth: '2026-07', limitCents: 60000 });
		expect(await listBud(h.db, h.userId, url('?periodMonth=2026-06'))).toHaveLength(1);
		expect(await listBud(h.db, h.userId, url())).toHaveLength(2);
	});

	it('createBud throws 400 on invalid body', async () => {
		await expect(
			createBud(h.db, h.userId, { categoryId, periodMonth: 'nope', limitCents: 1 })
		).rejects.toMatchObject({ status: 400, code: 'validation' });
	});

	it('createBud throws 400 for a category the user does not own', async () => {
		await expect(
			createBud(h.db, h.userId, {
				categoryId: 'cat-not-mine',
				periodMonth: '2026-06',
				limitCents: 1
			})
		).rejects.toMatchObject({ status: 400, code: 'validation' });
	});

	it('createBud throws 409 when a budget already exists for the category and month', async () => {
		await createBud(h.db, h.userId, { categoryId, periodMonth: '2026-06', limitCents: 50000 });
		await expect(
			createBud(h.db, h.userId, { categoryId, periodMonth: '2026-06', limitCents: 60000 })
		).rejects.toMatchObject({ status: 409, code: 'conflict' });
	});

	it('updateBud applies a partial body (limitCents only) and keeps other fields', async () => {
		const b = await createBud(h.db, h.userId, {
			categoryId,
			periodMonth: '2026-06',
			limitCents: 50000
		});
		const updated = await updateBud(h.db, h.userId, b.id, { limitCents: 80000 });
		expect(updated.limitCents).toBe(80000);
		expect(updated.categoryId).toBe(categoryId);
		expect(updated.periodMonth).toBe('2026-06');
	});

	it('getBud throws 404 for missing id', async () => {
		await expect(getBud(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateBud throws 404 for another user', async () => {
		const b = await createBud(h.db, h.userId, {
			categoryId,
			periodMonth: '2026-06',
			limitCents: 50000
		});
		await expect(
			updateBud(h.db, h.otherUserId, b.id, {
				categoryId,
				periodMonth: '2026-06',
				limitCents: 70000
			})
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteBud throws 404 when missing, succeeds when present', async () => {
		const b = await createBud(h.db, h.userId, {
			categoryId,
			periodMonth: '2026-06',
			limitCents: 50000
		});
		await expect(deleteBud(h.db, h.otherUserId, b.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteBud(h.db, h.userId, b.id)).resolves.toBeUndefined();
	});
});
