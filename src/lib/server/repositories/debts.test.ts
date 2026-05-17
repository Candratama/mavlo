import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	createDebt,
	deleteDebt,
	getDebt,
	listDebts,
	markDebtPaidOff,
	updateDebt
} from './debts';

let h: TestDbHandle;
const now = () => Date.now();

const insertAccount = (id: string, type = 'credit', userId?: string) => {
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run(id, userId ?? h.userId, 'Acc', type, 'IDR', 0, now(), now());
};

const baseInput = () => ({
	name: 'Credit Card BCA',
	type: 'credit_card' as const,
	principalCents: 10_000_000,
	currentBalanceCents: 4_500_000,
	interestRatePct: 2600,
	minimumPaymentCents: 250_000,
	startDate: Date.UTC(2026, 0, 1)
});

beforeEach(() => {
	h = createTestDb({
		tables: ['accounts', 'categories', 'transactions', 'budgets', 'budget_subsidies', 'debts']
	});
});

describe('createDebt', () => {
	it('creates a valid debt', async () => {
		const result = await createDebt(h.db, h.userId, baseInput());
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.name).toBe('Credit Card BCA');
		expect(result.status).toBe('active');
		expect(result.currentBalanceCents).toBe(4_500_000);
	});

	it('accepts optional fields', async () => {
		const result = await createDebt(h.db, h.userId, {
			...baseInput(),
			lender: 'Bank BCA',
			dueDay: 15,
			maturityDate: Date.UTC(2027, 0, 1),
			note: 'Primary card'
		});
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.lender).toBe('Bank BCA');
		expect(result.dueDay).toBe(15);
	});

	it('links to credit-type account', async () => {
		insertAccount('acc1', 'credit');
		const result = await createDebt(h.db, h.userId, { ...baseInput(), accountId: 'acc1' });
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.accountId).toBe('acc1');
	});

	it('rejects link to non-credit account', async () => {
		insertAccount('acc1', 'cash');
		const result = await createDebt(h.db, h.userId, { ...baseInput(), accountId: 'acc1' });
		expect('error' in result).toBe(true);
	});

	it('rejects unknown account', async () => {
		const result = await createDebt(h.db, h.userId, { ...baseInput(), accountId: 'nope' });
		expect('error' in result).toBe(true);
	});

	it('rejects cross-user account link', async () => {
		insertAccount('acc-other', 'credit', h.otherUserId);
		const result = await createDebt(h.db, h.userId, { ...baseInput(), accountId: 'acc-other' });
		expect('error' in result).toBe(true);
	});
});

describe('listDebts + getDebt', () => {
	beforeEach(async () => {
		await createDebt(h.db, h.userId, baseInput());
		await createDebt(h.db, h.userId, { ...baseInput(), name: 'KTA Bank' });
		await createDebt(h.db, h.otherUserId, baseInput());
	});

	it('lists own debts', async () => {
		const list = await listDebts(h.db, h.userId, {});
		expect(list).toHaveLength(2);
	});

	it('filters by status', async () => {
		const list = await listDebts(h.db, h.userId, { status: 'paid_off' });
		expect(list).toHaveLength(0);
	});

	it('getDebt cross-user returns null', async () => {
		const list = await listDebts(h.db, h.userId, {});
		const got = await getDebt(h.db, h.otherUserId, list[0].id);
		expect(got).toBeNull();
	});
});

describe('updateDebt', () => {
	it('updates own debt', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		const updated = await updateDebt(h.db, h.userId, {
			...baseInput(),
			id: created.id,
			minimumPaymentCents: 500_000
		});
		if ('error' in updated) throw new Error(updated.error);
		expect(updated.minimumPaymentCents).toBe(500_000);
	});

	it('cross-user update returns error', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		const updated = await updateDebt(h.db, h.otherUserId, {
			...baseInput(),
			id: created.id
		});
		expect('error' in updated).toBe(true);
	});

	it('preserves status when not provided', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		await markDebtPaidOff(h.db, h.userId, created.id);
		const updated = await updateDebt(h.db, h.userId, {
			...baseInput(),
			id: created.id,
			minimumPaymentCents: 999
		});
		if ('error' in updated) throw new Error(updated.error);
		expect(updated.status).toBe('paid_off');
	});

	it('applies provided status', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		const updated = await updateDebt(h.db, h.userId, {
			...baseInput(),
			id: created.id,
			status: 'in_arrears'
		});
		if ('error' in updated) throw new Error(updated.error);
		expect(updated.status).toBe('in_arrears');
	});
});

describe('deleteDebt', () => {
	it('deletes own debt', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		const deleted = await deleteDebt(h.db, h.userId, created.id);
		expect(deleted?.id).toBe(created.id);
		expect(await getDebt(h.db, h.userId, created.id)).toBeNull();
	});

	it('cross-user delete returns null', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		expect(await deleteDebt(h.db, h.otherUserId, created.id)).toBeNull();
	});
});

describe('markDebtPaidOff', () => {
	it('sets status and zeros balance', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		const result = await markDebtPaidOff(h.db, h.userId, created.id);
		expect(result?.status).toBe('paid_off');
		expect(result?.currentBalanceCents).toBe(0);
	});

	it('cross-user returns null', async () => {
		const created = await createDebt(h.db, h.userId, baseInput());
		if ('error' in created) throw new Error(created.error);
		expect(await markDebtPaidOff(h.db, h.otherUserId, created.id)).toBeNull();
	});
});
