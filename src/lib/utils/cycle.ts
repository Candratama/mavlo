export interface Cycle {
	start: Date;
	end: Date;
	periodMonth: string;
}

function clampStartDay(startDay: number): number {
	if (!Number.isFinite(startDay)) return 1;
	return Math.min(28, Math.max(1, Math.trunc(startDay)));
}

function getZonedYearMonthDay(date: Date, timezone: string): { y: number; m: number; d: number } {
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const parts = fmt.formatToParts(date);
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
	return { y: get('year'), m: get('month'), d: get('day') };
}

// Returns the UTC offset (ms) for the given timezone at the given UTC instant,
// using a midday probe. For zones without DST (e.g. Asia/Jakarta — Mavlo's
// primary target), this is exact. For DST zones, cycle boundaries that fall
// exactly on the DST transition hour may be off by 1 hour. Documented per
// the spec's DST concern; primary deployment timezone has no DST.
function getUtcOffsetMs(date: Date, timezone: string): number {
	// Use a noon-anchored date to avoid DST edge cases at midnight
	const noon = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0)
	);
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZoneName: 'longOffset'
	});
	const parts = fmt.formatToParts(noon);
	const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
	const match = tzName.match(/GMT([+-])(\d{2}):(\d{2})/);
	if (!match) return 0;
	const sign = match[1] === '+' ? 1 : -1;
	return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
}

function zonedDayStartUtc(year: number, month1to12: number, day: number, timezone: string): Date {
	// UTC instant that corresponds to year-month-day 00:00:00 in the given timezone.
	// Strategy: compute the timezone's UTC offset at noon of that day, then subtract it.
	const probe = new Date(Date.UTC(year, month1to12 - 1, day, 12, 0, 0));
	const offsetMs = getUtcOffsetMs(probe, timezone);
	return new Date(Date.UTC(year, month1to12 - 1, day, 0, 0, 0) - offsetMs);
}

function periodMonthStr(year: number, month1to12: number): string {
	return `${year}-${String(month1to12).padStart(2, '0')}`;
}

function addMonths(year: number, month1to12: number, delta: number): { y: number; m: number } {
	const idx = year * 12 + (month1to12 - 1) + delta;
	return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function getCycleForPeriod(periodYYYYMM: string, startDay: number, timezone: string): Cycle {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodYYYYMM)) {
		throw new RangeError(`Invalid periodYYYYMM: "${periodYYYYMM}"`);
	}
	const sd = clampStartDay(startDay);
	const [yStr, mStr] = periodYYYYMM.split('-');
	const y = Number(yStr);
	const m = Number(mStr);
	const start = zonedDayStartUtc(y, m, sd, timezone);
	const next = addMonths(y, m, 1);
	const end = zonedDayStartUtc(next.y, next.m, sd, timezone);
	return { start, end, periodMonth: periodMonthStr(y, m) };
}

export function getCurrentCycle(now: Date, startDay: number, timezone: string): Cycle {
	const sd = clampStartDay(startDay);
	const z = getZonedYearMonthDay(now, timezone);
	let anchorY = z.y;
	let anchorM = z.m;
	if (z.d < sd) {
		const prev = addMonths(z.y, z.m, -1);
		anchorY = prev.y;
		anchorM = prev.m;
	}
	return getCycleForPeriod(periodMonthStr(anchorY, anchorM), sd, timezone);
}

export function formatCycleLabel(cycle: Cycle, startDay: number, locale = 'en'): string {
	const sd = clampStartDay(startDay);
	if (sd === 1) {
		// Parse periodMonth directly to avoid local-timezone ambiguity when formatting.
		const [yStr, mStr] = cycle.periodMonth.split('-');
		// Use the 15th at noon UTC — safely within any timezone's display of that month.
		const anchor = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, 15, 12, 0, 0));
		return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor);
	}
	// For non-1 startDay: show "Sep 25 – Oct 24" style.
	// cycle.start/end are UTC instants of the zoned day boundaries (half-open).
	// ±12h: safe for any UTC offset within [-12, +14]; shifts UTC
	// instants to local midday for stable Intl date formatting.
	const halfDay = 12 * 60 * 60 * 1000;
	const startMidday = new Date(cycle.start.getTime() + halfDay);
	const endMidday = new Date(cycle.end.getTime() - halfDay);
	const dayFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
	return `${dayFmt.format(startMidday)} – ${dayFmt.format(endMidday)}`;
}
