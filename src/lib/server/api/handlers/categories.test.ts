import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { listCat, createCat, getCat, updateCat, deleteCat } from './categories';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['categories'] });
});

function url(qs = ''): URL {
	return new URL(`https://x/api/v1/categories${qs}`);
}

describe('categories handler', () => {
	it('createCat + listCat round-trips', async () => {
		const created = await createCat(h.db, h.userId, { name: 'Food', kind: 'expense' });
		expect(created.name).toBe('Food');
		expect(await listCat(h.db, h.userId, url())).toHaveLength(1);
	});

	it('createCat throws 400 on invalid body', async () => {
		await expect(createCat(h.db, h.userId, { name: '' })).rejects.toMatchObject({
			status: 400,
			code: 'validation'
		});
	});

	it('getCat throws 404 for missing id', async () => {
		await expect(getCat(h.db, h.userId, 'nope')).rejects.toMatchObject({ status: 404 });
	});

	it('updateCat throws 404 for another user', async () => {
		const c = await createCat(h.db, h.userId, { name: 'Food', kind: 'expense' });
		await expect(
			updateCat(h.db, h.otherUserId, c.id, { name: 'X', kind: 'expense' })
		).rejects.toMatchObject({ status: 404 });
	});

	it('deleteCat throws 404 when missing, succeeds when present', async () => {
		const c = await createCat(h.db, h.userId, { name: 'Food', kind: 'expense' });
		await expect(deleteCat(h.db, h.otherUserId, c.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteCat(h.db, h.userId, c.id)).resolves.toBeUndefined();
	});
});
