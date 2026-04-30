/**
 * Parse a user-entered Rupiah string to integer cents (1 IDR = 100 cents in our schema).
 * Accepts: "50.000", "Rp 50.000", "500", "0", with surrounding whitespace.
 * Returns null on invalid / negative input.
 */
export function parseRupiahToCents(input: string): number | null {
	if (typeof input !== 'string') return null;
	const cleaned = input
		.trim()
		.replace(/^Rp\s?/i, '')
		.trim();
	if (cleaned === '') return null;
	if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(cleaned)) return null;
	const digits = cleaned.replace(/\./g, '');
	const value = Number(digits);
	if (!Number.isFinite(value) || value < 0) return null;
	return value * 100;
}

/**
 * Format integer cents to dot-separated thousands without "Rp" prefix
 * (for in-input display).
 */
export function formatCentsToRupiah(cents: number): string {
	const rupiah = Math.trunc(cents / 100);
	return rupiah.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Full currency formatting (with Rp / locale).
 */
export function formatCentsAsCurrency(cents: number, currency: string): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency,
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(cents / 100);
}

/**
 * Compact currency formatting for tight UI (e.g. "Rp 9.9M", "Rp 1.2B", "Rp 350K").
 * Falls back to full Rp formatting for amounts < 10_000 IDR.
 */
export function formatCentsCompact(cents: number, currency: string = 'IDR'): string {
	const v = Math.trunc(cents / 100);
	const sign = v < 0 ? '-' : '';
	const abs = Math.abs(v);
	const prefix = currency === 'IDR' ? 'Rp ' : '';
	if (abs < 10_000) {
		return `${sign}${prefix}${abs.toLocaleString('id-ID')}`;
	}
	const round = (n: number) => {
		if (n >= 100) return Math.round(n).toString();
		const r = Math.round(n * 10) / 10;
		return r.toString();
	};
	if (abs >= 1_000_000_000) return `${sign}${prefix}${round(abs / 1_000_000_000)}B`;
	if (abs >= 1_000_000) return `${sign}${prefix}${round(abs / 1_000_000)}M`;
	return `${sign}${prefix}${round(abs / 1_000)}K`;
}
