import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listBgt, createBgt, getBgt, updateBgt, deleteBgt } from './budgets';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['categories', 'budgets'] });
	const now = Date.now();
	h.sqlite
		.prepare(
			'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
		)
		.run('cat1', h.userId, 'Food', 'expense', now, now);
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/budgets${qs}`);
}

describe('budgets handler', () => {
	it('createBgt + listBgt round-trips', async () => {
		const created = await createBgt(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-10',
			limitCents: 500000
		});
		expect(created.limitCents).toBe(500000);
		const rows = await listBgt(h.db, h.userId, url());
		expect(rows).toHaveLength(1);
	});

	it('listBgt filters by periodMonth', async () => {
		await createBgt(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-10',
			limitCents: 500000
		});
		await createBgt(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-11',
			limitCents: 600000
		});
		const rows = await listBgt(h.db, h.userId, url('?periodMonth=2026-10'));
		expect(rows).toHaveLength(1);
		expect(rows[0].periodMonth).toBe('2026-10');
	});

	it('createBgt throws 400 on invalid body', async () => {
		await expect(
			createBgt(h.db, h.userId, { categoryId: 'cat1', periodMonth: '2026-13' })
		).rejects.toMatchObject({ status: 400, code: 'validation' });
	});

	it('getBgt throws 404 for missing id', async () => {
		await expect(getBgt(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateBgt updates and returns the row', async () => {
		const created = await createBgt(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-10',
			limitCents: 500000
		});
		const updated = await updateBgt(h.db, h.userId, created.id, {
			categoryId: 'cat1',
			periodMonth: '2026-10',
			limitCents: 750000
		});
		expect(updated.limitCents).toBe(750000);
	});

	it('updateBgt throws 404 for missing id', async () => {
		await expect(
			updateBgt(h.db, h.userId, 'nope', {
				categoryId: 'cat1',
				periodMonth: '2026-10',
				limitCents: 1000
			})
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteBgt removes the row', async () => {
		const created = await createBgt(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-10',
			limitCents: 500000
		});
		await deleteBgt(h.db, h.userId, created.id);
		await expect(getBgt(h.db, h.userId, created.id)).rejects.toMatchObject({ status: 404 });
	});
});
