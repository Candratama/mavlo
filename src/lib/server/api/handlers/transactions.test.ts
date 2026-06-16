import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { ApiError } from '../errors';
import { listTx, createTx, getTx, updateTx, deleteTx } from './transactions';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({
		tables: ['accounts', 'categories', 'transactions', 'budgets', 'budget_subsidies', 'debts']
	});
	const now = Date.now();
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run('acc1', h.userId, 'Cash', 'cash', 'IDR', 0, now, now);
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/transactions${qs}`);
}

describe('transactions handler', () => {
	it('createTx + listTx round-trips', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 5000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		expect(created.amountCents).toBe(5000);
		const rows = await listTx(h.db, h.userId, url());
		expect(rows).toHaveLength(1);
	});

	it('createTx throws 400 on invalid body', async () => {
		await expect(createTx(h.db, h.userId, { kind: 'expense' })).rejects.toMatchObject({
			status: 400,
			code: 'validation'
		});
	});

	it('getTx throws 404 for missing id', async () => {
		await expect(getTx(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateTx updates and returns the row', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		const updated = await updateTx(h.db, h.userId, created.id, {
			accountId: 'acc1',
			amountCents: 2000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		expect(updated.amountCents).toBe(2000);
	});

	it('updateTx throws 404 for another user', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		await expect(
			updateTx(h.db, h.otherUserId, created.id, {
				accountId: 'acc1',
				amountCents: 2000,
				kind: 'expense',
				occurredAt: Date.now()
			})
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteTx throws 404 when missing, succeeds when present', async () => {
		const created = await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1000,
			kind: 'expense',
			occurredAt: Date.now()
		});
		await expect(deleteTx(h.db, h.otherUserId, created.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteTx(h.db, h.userId, created.id)).resolves.toBeUndefined();
	});

	it('listTx applies kind filter from query string', async () => {
		await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 1,
			kind: 'income',
			occurredAt: Date.now()
		});
		await createTx(h.db, h.userId, {
			accountId: 'acc1',
			amountCents: 2,
			kind: 'expense',
			occurredAt: Date.now()
		});
		expect(await listTx(h.db, h.userId, url('?kind=income'))).toHaveLength(1);
	});

	it('ApiError is the thrown type', async () => {
		await expect(getTx(h.db, h.userId, 'nope')).rejects.toBeInstanceOf(ApiError);
	});
});
