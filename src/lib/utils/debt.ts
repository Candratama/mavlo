export function paidPercent(principalCents: number, currentBalanceCents: number): number {
	if (principalCents <= 0) return 0;
	const paid = principalCents - currentBalanceCents;
	return Math.max(0, Math.min(100, Math.round((paid / principalCents) * 100)));
}

export function formatApr(intPct: number): string {
	const value = intPct / 100;
	return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function parseAprToInt(input: string): number | null {
	const cleaned = input.replace('%', '').trim();
	if (cleaned === '') return null;
	const value = Number(cleaned);
	if (!Number.isFinite(value) || value < 0) return null;
	return Math.round(value * 100);
}

export function dtiRatio(monthlyMinPaymentsCents: number, monthlyIncomeCents: number): number {
	if (monthlyIncomeCents <= 0) return 0;
	return Math.round((monthlyMinPaymentsCents / monthlyIncomeCents) * 100);
}

export type DtiStatus = 'safe' | 'moderate' | 'unsafe';

export function dtiStatus(percent: number): DtiStatus {
	if (percent < 20) return 'safe';
	if (percent <= 36) return 'moderate';
	return 'unsafe';
}

export function nextDueDate(dueDay: number, fromMs: number): number {
	const from = new Date(fromMs);
	const year = from.getUTCFullYear();
	const month = from.getUTCMonth();
	const day = from.getUTCDate();
	if (day <= dueDay) {
		return Date.UTC(year, month, dueDay);
	}
	return Date.UTC(year, month + 1, dueDay);
}
