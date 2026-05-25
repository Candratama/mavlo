import { describe, it, expect } from 'vitest';
import {
	getCurrentCycle,
	getCycleForPeriod,
	formatCycleLabel,
	formatYmdInTimezone,
	ymdToZonedDayStartMs
} from './cycle';

const TZ = 'Asia/Jakarta';

describe('getCurrentCycle', () => {
	it('startDay=1 returns calendar month boundaries', () => {
		const now = new Date('2026-09-15T12:00:00Z');
		const c = getCurrentCycle(now, 1, TZ);
		expect(c.periodMonth).toBe('2026-09');
		// Sep 1 00:00 Asia/Jakarta = Aug 31 17:00 UTC
		expect(c.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-09-30T17:00:00.000Z');
	});

	it('startDay=25 with now before the 25th returns previous-month cycle', () => {
		const now = new Date('2026-09-10T12:00:00Z');
		const c = getCurrentCycle(now, 25, TZ);
		expect(c.periodMonth).toBe('2026-08');
		expect(c.start.toISOString()).toBe('2026-08-24T17:00:00.000Z'); // Aug 25 Jakarta
		expect(c.end.toISOString()).toBe('2026-09-24T17:00:00.000Z'); // Sep 25 Jakarta
	});

	it('startDay=25 with now on or after the 25th returns current-month cycle', () => {
		const now = new Date('2026-09-26T12:00:00Z');
		const c = getCurrentCycle(now, 25, TZ);
		expect(c.periodMonth).toBe('2026-09');
		expect(c.start.toISOString()).toBe('2026-09-24T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-10-24T17:00:00.000Z');
	});

	it('startDay clamps to 28 (Feb safety) for caller convenience', () => {
		const now = new Date('2026-02-10T12:00:00Z');
		const c = getCurrentCycle(now, 31, TZ);
		// Implementation must cap input at 28
		expect(c.periodMonth).toBe('2026-01');
	});
});

describe('getCycleForPeriod', () => {
	it('startDay=1 maps period to calendar month', () => {
		const c = getCycleForPeriod('2026-09', 1, TZ);
		expect(c.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-09-30T17:00:00.000Z');
	});

	it('startDay=25 maps period to anchor-month-25 → next-month-25', () => {
		const c = getCycleForPeriod('2026-09', 25, TZ);
		expect(c.start.toISOString()).toBe('2026-09-24T17:00:00.000Z');
		expect(c.end.toISOString()).toBe('2026-10-24T17:00:00.000Z');
	});

	it('throws RangeError for malformed periodYYYYMM', () => {
		expect(() => getCycleForPeriod('invalid', 1, TZ)).toThrow(RangeError);
		expect(() => getCycleForPeriod('2026-13', 1, TZ)).toThrow(RangeError);
		expect(() => getCycleForPeriod('2026-1', 1, TZ)).toThrow(RangeError);
	});
});

describe('formatCycleLabel', () => {
	it('returns "September 2026" for startDay=1', () => {
		const c = getCycleForPeriod('2026-09', 1, TZ);
		expect(formatCycleLabel(c, 1, 'en')).toBe('September 2026');
	});

	it('returns "Sep 25 – Oct 24" for startDay=25', () => {
		const c = getCycleForPeriod('2026-09', 25, TZ);
		const label = formatCycleLabel(c, 25, 'en');
		expect(label).toMatch(/Sep 25.*Oct 24/);
	});
});

describe('transaction calendar dates', () => {
	it('formats today in the configured timezone instead of UTC', () => {
		const jakartaAfterMidnight = new Date('2026-05-24T18:00:00.000Z');
		expect(formatYmdInTimezone(jakartaAfterMidnight, TZ)).toBe('2026-05-25');
	});

	it('parses a YYYY-MM-DD as start of day in the configured timezone', () => {
		expect(new Date(ymdToZonedDayStartMs('2026-05-25', TZ)).toISOString()).toBe(
			'2026-05-24T17:00:00.000Z'
		);
	});
});
