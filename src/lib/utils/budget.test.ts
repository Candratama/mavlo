import { describe, expect, it } from 'vitest';
import { effectiveLimit, sourceRemaining } from './budget';

describe('effectiveLimit', () => {
	it('adds inflow', () => {
		expect(effectiveLimit(1000, { in: 200, out: 0 })).toBe(1200);
	});

	it('subtracts outflow', () => {
		expect(effectiveLimit(500, { in: 0, out: 200 })).toBe(300);
	});

	it('handles mixed flow', () => {
		expect(effectiveLimit(500, { in: 100, out: 50 })).toBe(550);
	});

	it('returns original when no flow', () => {
		expect(effectiveLimit(1000, { in: 0, out: 0 })).toBe(1000);
	});
});

describe('sourceRemaining', () => {
	it('returns positive when limit > spent + out', () => {
		expect(sourceRemaining({ limitCents: 1000, spentCents: 300, subsidyOutCents: 200 })).toBe(500);
	});

	it('returns 0 when fully used', () => {
		expect(sourceRemaining({ limitCents: 1000, spentCents: 800, subsidyOutCents: 200 })).toBe(0);
	});

	it('returns negative when over-committed', () => {
		expect(sourceRemaining({ limitCents: 1000, spentCents: 900, subsidyOutCents: 200 })).toBe(-100);
	});
});
