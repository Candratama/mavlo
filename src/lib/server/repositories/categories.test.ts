import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	listCategories,
	createCategory,
	updateCategory,
	archiveCategory,
	unarchiveCategory,
	getCategory,
	ensureDebtPaymentCategory
} from './categories';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['categories'] });
});

describe('categories repository', () => {
	it('listCategories returns user-scoped non-archived', async () => {
		await createCategory(h.db, h.userId, { name: 'Food', kind: 'expense' });
		await createCategory(h.db, h.userId, { name: 'Salary', kind: 'income' });
		await createCategory(h.db, h.otherUserId, { name: 'Other', kind: 'expense' });

		const list = await listCategories(h.db, h.userId, { includeArchived: false });
		expect(list).toHaveLength(2);
	});

	it('updateCategory cross-user returns null', async () => {
		const c = await createCategory(h.db, h.userId, { name: 'Food', kind: 'expense' });
		expect(
			await updateCategory(h.db, h.otherUserId, { id: c.id, name: 'X', kind: 'expense' })
		).toBeNull();
	});

	it('archiveCategory + listCategories filter', async () => {
		const c = await createCategory(h.db, h.userId, { name: 'Food', kind: 'expense' });
		await archiveCategory(h.db, h.userId, c.id);
		expect(await listCategories(h.db, h.userId, { includeArchived: false })).toHaveLength(0);
		expect(await listCategories(h.db, h.userId, { includeArchived: true })).toHaveLength(1);
		await unarchiveCategory(h.db, h.userId, c.id);
		expect(await listCategories(h.db, h.userId, { includeArchived: false })).toHaveLength(1);
	});

	it('getCategory cross-user returns null', async () => {
		const c = await createCategory(h.db, h.userId, { name: 'Food', kind: 'expense' });
		expect(await getCategory(h.db, h.otherUserId, c.id)).toBeNull();
	});
});

describe('ensureDebtPaymentCategory', () => {
	it('creates if missing, returns existing id on second call', async () => {
		const id1 = await ensureDebtPaymentCategory(h.db, h.userId);
		const id2 = await ensureDebtPaymentCategory(h.db, h.userId);
		expect(id1).toBe(id2);
		expect(typeof id1).toBe('string');
	});

	it('scoped per user', async () => {
		const id1 = await ensureDebtPaymentCategory(h.db, h.userId);
		const id2 = await ensureDebtPaymentCategory(h.db, h.otherUserId);
		expect(id1).not.toBe(id2);
	});
});
