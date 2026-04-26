import { describe, it, expect } from 'vitest';
import { parseRupiahToCents, formatCentsToRupiah, formatCentsAsCurrency } from './money';

describe('parseRupiahToCents', () => {
	it('parses dot-separated thousands', () => {
		expect(parseRupiahToCents('50.000')).toBe(5_000_000);
		expect(parseRupiahToCents('1.234.567')).toBe(123_456_700);
	});

	it('parses bare integers', () => {
		expect(parseRupiahToCents('500')).toBe(50_000);
		expect(parseRupiahToCents('0')).toBe(0);
	});

	it('strips currency prefix and trims', () => {
		expect(parseRupiahToCents('Rp 50.000')).toBe(5_000_000);
		expect(parseRupiahToCents('  Rp50.000  ')).toBe(5_000_000);
	});

	it('returns null on bad input', () => {
		expect(parseRupiahToCents('')).toBeNull();
		expect(parseRupiahToCents('abc')).toBeNull();
		expect(parseRupiahToCents('-100')).toBeNull();
	});
});

describe('formatCentsToRupiah', () => {
	it('formats cents to dot-separated thousands (no Rp prefix)', () => {
		expect(formatCentsToRupiah(5_000_000)).toBe('50.000');
		expect(formatCentsToRupiah(0)).toBe('0');
		expect(formatCentsToRupiah(123_456_700)).toBe('1.234.567');
	});
});

describe('formatCentsAsCurrency', () => {
	it('renders with Rp prefix and locale separator', () => {
		expect(formatCentsAsCurrency(5_000_000, 'IDR')).toMatch(/Rp\s?50\.000/);
	});
});
