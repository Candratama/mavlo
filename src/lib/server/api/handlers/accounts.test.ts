import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listAcc, createAcc, getAcc, updateAcc, deleteAcc } from './accounts';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts'] });
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/accounts${qs}`);
}

describe('accounts handler', () => {
	it('createAcc + listAcc round-trips', async () => {
		const created = await createAcc(h.db, h.userId, { name: 'Bank', type: 'bank', currency: 'IDR' });
		expect(created.name).toBe('Bank');
		expect(await listAcc(h.db, h.userId, url())).toHaveLength(1);
	});

	it('createAcc throws 400 on invalid body', async () => {
		await expect(createAcc(h.db, h.userId, { name: '' })).rejects.toMatchObject({
			status: 400,
			code: 'validation'
		});
	});

	it('listAcc excludes archived by default and includes them with ?includeArchived=true', async () => {
		const a = await createAcc(h.db, h.userId, { name: 'A', type: 'cash', currency: 'IDR' });
		h.sqlite.prepare('UPDATE accounts SET archived = 1 WHERE id = ?').run(a.id);
		expect(await listAcc(h.db, h.userId, url())).toHaveLength(0);
		expect(await listAcc(h.db, h.userId, url('?includeArchived=true'))).toHaveLength(1);
	});

	it('getAcc throws 404 for missing id', async () => {
		await expect(getAcc(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateAcc throws 404 for another user', async () => {
		const a = await createAcc(h.db, h.userId, { name: 'A', type: 'cash', currency: 'IDR' });
		await expect(
			updateAcc(h.db, h.otherUserId, a.id, { name: 'B', type: 'cash', currency: 'IDR' })
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteAcc throws 404 when missing, succeeds when present', async () => {
		const a = await createAcc(h.db, h.userId, { name: 'A', type: 'cash', currency: 'IDR' });
		await expect(deleteAcc(h.db, h.otherUserId, a.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteAcc(h.db, h.userId, a.id)).resolves.toBeUndefined();
	});
});
