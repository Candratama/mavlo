import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { toErrorResponse } from '../respond';
import { listBgt, createBgt, getBgt, updateBgt, deleteBgt } from './budgets';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({
		tables: [
			'accounts',
			'categories',
			'transactions',
			'budgets',
			'budget_subsidies',
			'user_preferences'
		]
	});
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

	it('maps a foreign category to 400 validation', async () => {
		const now = Date.now();
		h.sqlite
			.prepare(
				'INSERT INTO categories (id, user_id, name, kind, color, icon, archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)'
			)
			.run('cat-other', h.otherUserId, 'Theirs', 'expense', now, now);
		const res = await createBgt(h.db, h.userId, {
			categoryId: 'cat-other',
			periodMonth: '2026-10',
			limitCents: 1000
		}).catch(toErrorResponse);
		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(400);
		expect(await (res as Response).json()).toEqual({
			error: { code: 'validation', message: 'Category not found' }
		});
	});

	it('maps a duplicate (retried POST) to 409 conflict', async () => {
		const body = { categoryId: 'cat1', periodMonth: '2026-10', limitCents: 1000 };
		await createBgt(h.db, h.userId, body);
		const res = (await createBgt(h.db, h.userId, body).catch(toErrorResponse)) as Response;
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: { code: 'conflict' } });
	});

	it('listBgt ignores an empty periodMonth', async () => {
		await createBgt(h.db, h.userId, { categoryId: 'cat1', periodMonth: '2026-10', limitCents: 1 });
		expect(await listBgt(h.db, h.userId, url('?periodMonth='))).toHaveLength(1);
	});

	it("reports spending inside the user's cycle, not the calendar month", async () => {
		const now = Date.now();
		h.sqlite
			.prepare(
				'INSERT INTO user_preferences (user_id, timezone, month_start_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
			)
			.run(h.userId, 'UTC', 25, now, now);
		h.sqlite
			.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
			.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
		const tx = h.sqlite.prepare(
			"INSERT INTO transactions (id, user_id, account_id, kind, category_id, amount_cents, occurred_at, created_at, updated_at) VALUES (?, ?, 'acc1', 'expense', 'cat1', ?, ?, ?, ?)"
		);
		// Cycle 2026-10 with start day 25 = [Oct 25, Nov 25) UTC.
		tx.run('t-in-1', h.userId, 30000, Date.UTC(2026, 9, 26), now, now);
		tx.run('t-in-2', h.userId, 20000, Date.UTC(2026, 10, 24), now, now);
		tx.run('t-before', h.userId, 99999, Date.UTC(2026, 9, 10), now, now);
		tx.run('t-after', h.userId, 99999, Date.UTC(2026, 10, 25), now, now);

		const b = await createBgt(h.db, h.userId, {
			categoryId: 'cat1',
			periodMonth: '2026-10',
			limitCents: 100000
		});
		expect(b.periodStart).toBe(Date.UTC(2026, 9, 25));
		expect(b.periodEnd).toBe(Date.UTC(2026, 10, 25));
		expect(b.spentCents).toBe(50000);
		expect(b.remainingCents).toBe(50000);
	});
});
