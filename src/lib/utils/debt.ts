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

export type PayoffProjection = {
	months: number;
	totalInterestCents: number;
	totalPaidCents: number;
	freeAtMs: number;
} | null;

/**
 * Compute payoff timeline given current balance, monthly payment, and APR.
 * Returns null when the payment can't cover monthly interest (debt grows forever)
 * or when balance/payment is non-positive.
 *
 * @param balanceCents Current outstanding balance in cents
 * @param monthlyPaymentCents Monthly payment amount in cents
 * @param aprIntPct APR stored as int × 100 (e.g., 2600 = 26%)
 * @param fromMs Anchor date for the "free at" projection (defaults to now)
 */
export function payoffProjection(
	balanceCents: number,
	monthlyPaymentCents: number,
	aprIntPct: number,
	fromMs: number = Date.now()
): PayoffProjection {
	if (balanceCents <= 0 || monthlyPaymentCents <= 0) return null;

	const monthlyRate = aprIntPct / 12 / 100 / 100;

	let months: number;
	if (monthlyRate === 0) {
		months = Math.ceil(balanceCents / monthlyPaymentCents);
	} else {
		const monthlyInterest = balanceCents * monthlyRate;
		if (monthlyPaymentCents <= monthlyInterest) return null;
		// months = -ln(1 - balance*rate/payment) / ln(1 + rate)
		const inner = 1 - (balanceCents * monthlyRate) / monthlyPaymentCents;
		months = Math.ceil(-Math.log(inner) / Math.log(1 + monthlyRate));
	}

	const totalPaidCents = monthlyPaymentCents * months;
	const totalInterestCents = Math.max(0, totalPaidCents - balanceCents);
	const freeAtMs = new Date(fromMs).setUTCMonth(new Date(fromMs).getUTCMonth() + months);

	return { months, totalInterestCents, totalPaidCents, freeAtMs };
}
