import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDbHandle } from '$lib/server/db/test-fixtures';
import { createDebt, markDebtPaidOff } from './debts';
import { computeDebtTotals } from './debt-stats';

let h: TestDbHandle;

beforeEach(() => {
	h = createTestDb({
		tables: ['accounts', 'categories', 'transactions', 'budgets', 'budget_subsidies', 'debts']
	});
});

const baseDebt = (overrides = {}) => ({
	name: 'CC',
	type: 'credit_card' as const,
	principalCents: 10_000_000,
	currentBalanceCents: 5_000_000,
	interestRatePct: 2600,
	minimumPaymentCents: 250_000,
	startDate: Date.UTC(2026, 0, 1),
	...overrides
});

describe('computeDebtTotals', () => {
	it('returns zeros when no debts', async () => {
		const result = await computeDebtTotals(h.db, h.userId);
		expect(result.totalBalanceCents).toBe(0);
		expect(result.totalMinPaymentCents).toBe(0);
		expect(result.upcomingPayments).toEqual([]);
	});

	it('sums active debts', async () => {
		await createDebt(
			h.db,
			h.userId,
			baseDebt({ currentBalanceCents: 3_000_000, minimumPaymentCents: 200_000 })
		);
		await createDebt(
			h.db,
			h.userId,
			baseDebt({ currentBalanceCents: 5_000_000, minimumPaymentCents: 300_000 })
		);
		const result = await computeDebtTotals(h.db, h.userId);
		expect(result.totalBalanceCents).toBe(8_000_000);
		expect(result.totalMinPaymentCents).toBe(500_000);
	});

	it('excludes paid-off debts from totals', async () => {
		const d1 = await createDebt(h.db, h.userId, baseDebt({ currentBalanceCents: 3_000_000 }));
		await createDebt(h.db, h.userId, baseDebt({ currentBalanceCents: 5_000_000 }));
		if ('error' in d1) throw new Error(d1.error);
		await markDebtPaidOff(h.db, h.userId, d1.id);
		const result = await computeDebtTotals(h.db, h.userId);
		expect(result.totalBalanceCents).toBe(5_000_000);
	});

	it('filters by user', async () => {
		await createDebt(h.db, h.otherUserId, baseDebt());
		const result = await computeDebtTotals(h.db, h.userId);
		expect(result.totalBalanceCents).toBe(0);
	});

	it('lists upcoming payments within 30 days', async () => {
		const now = Date.UTC(2026, 4, 10); // May 10, 2026
		await createDebt(
			h.db,
			h.userId,
			baseDebt({ name: 'A', dueDay: 15, minimumPaymentCents: 100_000 })
		); // May 15
		await createDebt(
			h.db,
			h.userId,
			baseDebt({ name: 'B', dueDay: 20, minimumPaymentCents: 200_000 })
		); // May 20
		await createDebt(h.db, h.userId, baseDebt({ name: 'C' })); // no dueDay
		const result = await computeDebtTotals(h.db, h.userId, now);
		expect(result.upcomingPayments).toHaveLength(2);
		expect(result.upcomingPayments[0].debtName).toBe('A'); // May 15 first
		expect(result.upcomingPayments[1].debtName).toBe('B'); // May 20 second
		expect(result.upcomingPayments[0].minAmountCents).toBe(100_000);
	});

	it('excludes paid-off from upcoming', async () => {
		const now = Date.UTC(2026, 4, 10);
		const d = await createDebt(h.db, h.userId, baseDebt({ dueDay: 15 }));
		if ('error' in d) throw new Error(d.error);
		await markDebtPaidOff(h.db, h.userId, d.id);
		const result = await computeDebtTotals(h.db, h.userId, now);
		expect(result.upcomingPayments).toHaveLength(0);
	});
});
