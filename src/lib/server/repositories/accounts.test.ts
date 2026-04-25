import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	listAccounts,
	createAccount,
	updateAccount,
	archiveAccount,
	unarchiveAccount,
	getAccount
} from './accounts';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({ tables: ['accounts'] });
});

describe('accounts repository', () => {
	it('createAccount + listAccounts returns own only', async () => {
		await createAccount(h.db, h.userId, {
			name: 'Cash',
			type: 'cash',
			currency: 'IDR',
			initialBalanceCents: 100000
		});
		await createAccount(h.db, h.otherUserId, {
			name: 'Other',
			type: 'cash',
			currency: 'IDR',
			initialBalanceCents: 0
		});

		const list = await listAccounts(h.db, h.userId, { includeArchived: false });
		expect(list).toHaveLength(1);
		expect(list[0].name).toBe('Cash');
	});

	it('updateAccount only updates own', async () => {
		const created = await createAccount(h.db, h.userId, {
			name: 'Cash',
			type: 'cash',
			currency: 'IDR',
			initialBalanceCents: 0
		});
		const updated = await updateAccount(h.db, h.userId, {
			id: created.id,
			name: 'Cash Renamed',
			type: 'bank',
			currency: 'USD',
			initialBalanceCents: 500
		});
		expect(updated?.name).toBe('Cash Renamed');
		expect(updated?.type).toBe('bank');
	});

	it('updateAccount returns null when not own', async () => {
		const created = await createAccount(h.db, h.userId, {
			name: 'Cash',
			type: 'cash',
			currency: 'IDR',
			initialBalanceCents: 0
		});
		const updated = await updateAccount(h.db, h.otherUserId, {
			id: created.id,
			name: 'Hijack',
			type: 'cash',
			currency: 'IDR',
			initialBalanceCents: 0
		});
		expect(updated).toBeNull();
	});

	it('archiveAccount + unarchiveAccount + listAccounts archived filter', async () => {
		const created = await createAccount(h.db, h.userId, {
			name: 'Cash',
			type: 'cash',
			currency: 'IDR',
			initialBalanceCents: 0
		});
		await archiveAccount(h.db, h.userId, created.id);
		expect(await listAccounts(h.db, h.userId, { includeArchived: false })).toHaveLength(0);
		expect(await listAccounts(h.db, h.userId, { includeArchived: true })).toHaveLength(1);
		await unarchiveAccount(h.db, h.userId, created.id);
		expect(await listAccounts(h.db, h.userId, { includeArchived: false })).toHaveLength(1);
	});

	it('getAccount returns null for other user', async () => {
		const created = await createAccount(h.db, h.userId, {
			name: 'Cash',
			type: 'cash',
			currency: 'IDR',
			initialBalanceCents: 0
		});
		expect(await getAccount(h.db, h.userId, created.id)).not.toBeNull();
		expect(await getAccount(h.db, h.otherUserId, created.id)).toBeNull();
	});
});
