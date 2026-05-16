import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import {
	createSubsidy,
	deleteSubsidy,
	getSubsidy,
	listSubsidies,
	updateSubsidy
} from './subsidies';

let h: TestDbHandle;
const now = () => Date.now();

const insertCategory = (id: string, userId: string, name = 'X') => {
	h.sqlite
		.prepare('INSERT INTO categories VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, ?, ?)')
		.run(id, userId, name, 'expense', now(), now());
};

const insertBudget = (
	id: string,
	categoryId: string,
	limit: number,
	period = '2026-04',
	userId?: string
) => {
	h.sqlite
		.prepare('INSERT INTO budgets VALUES (?, ?, ?, ?, ?, ?, ?)')
		.run(id, userId ?? h.userId, categoryId, period, limit, now(), now());
};

const insertAccount = (id: string, userId?: string) => {
	h.sqlite
		.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)')
		.run(id, userId ?? h.userId, 'Acc', 'cash', 'IDR', 0, now(), now());
};

const insertExpense = (
	id: string,
	categoryId: string,
	amount: number,
	occurredAt: number,
	accountId = 'acc1',
	userId?: string
) => {
	h.sqlite
		.prepare(
			`INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, 0)`
		)
		.run(
			id,
			userId ?? h.userId,
			accountId,
			categoryId,
			amount,
			'expense',
			occurredAt,
			occurredAt,
			occurredAt
		);
};

const apr2026Mid = Date.UTC(2026, 3, 15);

beforeEach(() => {
	h = createTestDb({
		tables: ['accounts', 'categories', 'transactions', 'budgets', 'budget_subsidies']
	});
	insertAccount('acc1');
	insertCategory('cat-food', h.userId, 'Food');
	insertCategory('cat-trans', h.userId, 'Transport');
	insertBudget('b-food', 'cat-food', 1_000_000);
	insertBudget('b-trans', 'cat-trans', 500_000);
});

describe('createSubsidy', () => {
	it('rejects when target not overspent', async () => {
		insertExpense('t1', 'cat-food', 500_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when source has no remaining', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 500_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when amount exceeds source remaining', async () => {
		insertExpense('t1', 'cat-food', 1_500_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 300_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 300_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when amount exceeds target overage', async () => {
		insertExpense('t1', 'cat-food', 1_100_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 200_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects when budgets are different periods', async () => {
		insertBudget('b-food-may', 'cat-food', 1_000_000, '2026-05');
		insertExpense('t1', 'cat-food', 1_500_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food-may',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('rejects cross-user budgets', async () => {
		insertCategory('cat-other', h.otherUserId);
		insertBudget('b-other', 'cat-other', 1_000_000, '2026-04', h.otherUserId);
		insertExpense('t1', 'cat-other', 1_500_000, apr2026Mid, 'acc1', h.otherUserId);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-other',
			amountCents: 100_000
		});
		expect('error' in result).toBe(true);
	});

	it('creates valid subsidy', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const result = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 200_000,
			note: 'top up'
		});
		expect('error' in result).toBe(false);
		if ('error' in result) return;
		expect(result.amountCents).toBe(200_000);
		expect(result.periodMonth).toBe('2026-04');
		expect(result.note).toBe('top up');
	});
});

describe('listSubsidies + getSubsidy', () => {
	beforeEach(async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
	});

	it('lists subsidies for the period', async () => {
		const list = await listSubsidies(h.db, h.userId, { periodMonth: '2026-04' });
		expect(list).toHaveLength(1);
	});

	it('filters cross-user', async () => {
		const list = await listSubsidies(h.db, h.otherUserId, {
			periodMonth: '2026-04'
		});
		expect(list).toHaveLength(0);
	});

	it('getSubsidy returns row for own user', async () => {
		const list = await listSubsidies(h.db, h.userId, { periodMonth: '2026-04' });
		const got = await getSubsidy(h.db, h.userId, list[0].id);
		expect(got?.id).toBe(list[0].id);
	});

	it('getSubsidy returns null cross-user', async () => {
		const list = await listSubsidies(h.db, h.userId, { periodMonth: '2026-04' });
		const got = await getSubsidy(h.db, h.otherUserId, list[0].id);
		expect(got).toBeNull();
	});
});

describe('updateSubsidy', () => {
	beforeEach(() => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
	});

	it('allows reducing amount even when target no longer overspent', async () => {
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 200_000
		});
		if ('error' in created) throw new Error(created.error);
		const updated = await updateSubsidy(h.db, h.userId, {
			id: created.id,
			amountCents: 50_000
		});
		expect('error' in updated).toBe(false);
		if ('error' in updated) return;
		expect(updated.amountCents).toBe(50_000);
	});

	it('rejects amount exceeding source slack (excluding self)', async () => {
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		const updated = await updateSubsidy(h.db, h.userId, {
			id: created.id,
			amountCents: 350_000
		});
		expect('error' in updated).toBe(true);
	});

	it('ignores from/to in payload (immutable)', async () => {
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		const updated = await updateSubsidy(h.db, h.userId, {
			id: created.id,
			amountCents: 50_000
		});
		if ('error' in updated) throw new Error(updated.error);
		expect(updated.fromBudgetId).toBe('b-trans');
		expect(updated.toBudgetId).toBe('b-food');
	});

	it('returns error for unknown id', async () => {
		const result = await updateSubsidy(h.db, h.userId, {
			id: 'nope',
			amountCents: 1000
		});
		expect('error' in result).toBe(true);
	});
});

describe('deleteSubsidy', () => {
	it('deletes own subsidy', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		const deleted = await deleteSubsidy(h.db, h.userId, created.id);
		expect(deleted?.id).toBe(created.id);
		expect(await getSubsidy(h.db, h.userId, created.id)).toBeNull();
	});

	it('cross-user delete returns null', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		expect(await deleteSubsidy(h.db, h.otherUserId, created.id)).toBeNull();
	});
});

describe('cascade delete on budget', () => {
	it('removes subsidies when source budget is deleted', async () => {
		insertExpense('t1', 'cat-food', 1_200_000, apr2026Mid);
		insertExpense('t2', 'cat-trans', 200_000, apr2026Mid);
		const created = await createSubsidy(h.db, h.userId, {
			fromBudgetId: 'b-trans',
			toBudgetId: 'b-food',
			amountCents: 100_000
		});
		if ('error' in created) throw new Error(created.error);
		h.sqlite.prepare('DELETE FROM budgets WHERE id = ?').run('b-trans');
		expect(await getSubsidy(h.db, h.userId, created.id)).toBeNull();
	});
});
