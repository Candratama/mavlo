import { describe, expect, it } from 'vitest';
import {
	paidPercent,
	formatApr,
	parseAprToInt,
	dtiRatio,
	dtiStatus,
	nextDueDate,
	payoffProjection
} from './debt';

describe('paidPercent', () => {
	it('computes percent paid', () => {
		expect(paidPercent(10_000_000, 4_500_000)).toBe(55);
	});

	it('clamps at 100 when overpaid', () => {
		expect(paidPercent(1000, -100)).toBe(100);
	});

	it('returns 0 for zero principal', () => {
		expect(paidPercent(0, 0)).toBe(0);
	});

	it('returns 0 when balance equals principal', () => {
		expect(paidPercent(1000, 1000)).toBe(0);
	});
});

describe('formatApr', () => {
	it('formats whole percent', () => {
		expect(formatApr(2600)).toBe('26%');
	});

	it('formats fractional percent', () => {
		expect(formatApr(2650)).toBe('26.5%');
	});

	it('formats zero', () => {
		expect(formatApr(0)).toBe('0%');
	});
});

describe('parseAprToInt', () => {
	it('parses percent string', () => {
		expect(parseAprToInt('26.5%')).toBe(2650);
	});

	it('parses without percent sign', () => {
		expect(parseAprToInt('26.5')).toBe(2650);
	});

	it('returns null for invalid', () => {
		expect(parseAprToInt('abc')).toBe(null);
	});

	it('returns null for negative', () => {
		expect(parseAprToInt('-1')).toBe(null);
	});

	it('parses zero', () => {
		expect(parseAprToInt('0')).toBe(0);
	});
});

describe('dtiRatio', () => {
	it('computes percent', () => {
		expect(dtiRatio(1_000_000, 10_000_000)).toBe(10);
	});

	it('returns 0 when income is zero', () => {
		expect(dtiRatio(500_000, 0)).toBe(0);
	});

	it('returns 0 when income is negative', () => {
		expect(dtiRatio(500_000, -1)).toBe(0);
	});
});

describe('dtiStatus', () => {
	it('safe < 20', () => {
		expect(dtiStatus(15)).toBe('safe');
		expect(dtiStatus(19)).toBe('safe');
	});

	it('moderate 20-36', () => {
		expect(dtiStatus(20)).toBe('moderate');
		expect(dtiStatus(36)).toBe('moderate');
	});

	it('unsafe > 36', () => {
		expect(dtiStatus(37)).toBe('unsafe');
		expect(dtiStatus(100)).toBe('unsafe');
	});
});

describe('nextDueDate', () => {
	it('returns this month when day not yet passed', () => {
		const from = Date.UTC(2026, 4, 10); // May 10, 2026 UTC
		const result = nextDueDate(15, from);
		const d = new Date(result);
		expect(d.getUTCMonth()).toBe(4); // May
		expect(d.getUTCDate()).toBe(15);
	});

	it('returns same day when today is due day', () => {
		const from = Date.UTC(2026, 4, 15);
		const result = nextDueDate(15, from);
		const d = new Date(result);
		expect(d.getUTCMonth()).toBe(4);
		expect(d.getUTCDate()).toBe(15);
	});

	it('returns next month when day already passed', () => {
		const from = Date.UTC(2026, 4, 20);
		const result = nextDueDate(15, from);
		const d = new Date(result);
		expect(d.getUTCMonth()).toBe(5); // June
		expect(d.getUTCDate()).toBe(15);
	});
});

describe('payoffProjection', () => {
	it('returns null when balance is zero', () => {
		expect(payoffProjection(0, 100_000, 2600)).toBeNull();
	});

	it('returns null when payment is zero', () => {
		expect(payoffProjection(1_000_000, 0, 2600)).toBeNull();
	});

	it('zero APR: months = ceil(balance / payment)', () => {
		const r = payoffProjection(1_000_000, 100_000, 0);
		expect(r?.months).toBe(10);
		expect(r?.totalInterestCents).toBe(0);
	});

	it('null when payment cannot cover monthly interest', () => {
		// 10M at 26% APR has monthly interest ≈ 216,667. Pay 100k < that → infinite.
		expect(payoffProjection(10_000_000, 100_000, 2600)).toBeNull();
	});

	it('computes months and interest for typical CC', () => {
		// Rp 5M balance, Rp 500K/month, 26% APR
		const r = payoffProjection(5_000_000, 500_000, 2600);
		expect(r).not.toBeNull();
		if (!r) return;
		expect(r.months).toBeGreaterThan(10);
		expect(r.months).toBeLessThan(13);
		expect(r.totalInterestCents).toBeGreaterThan(0);
		expect(r.totalPaidCents).toBeGreaterThan(5_000_000);
	});

	it('larger payment = fewer months + less interest', () => {
		const slow = payoffProjection(5_000_000, 300_000, 2600);
		const fast = payoffProjection(5_000_000, 800_000, 2600);
		expect(slow).not.toBeNull();
		expect(fast).not.toBeNull();
		if (!slow || !fast) return;
		expect(fast.months).toBeLessThan(slow.months);
		expect(fast.totalInterestCents).toBeLessThan(slow.totalInterestCents);
	});
});
