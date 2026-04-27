import { describe, it, expect } from 'vitest';
import { preferencesUpdateSchema } from './preferences';

describe('preferences validation', () => {
	const valid = {
		currency: 'IDR',
		locale: 'id-ID',
		timezone: 'Asia/Jakarta',
		theme: 'light',
		weekStartsOn: 1,
		monthStartDay: 1
	};

	it('accepts valid input', () => {
		expect(preferencesUpdateSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects invalid theme', () => {
		expect(preferencesUpdateSchema.safeParse({ ...valid, theme: 'magenta' }).success).toBe(false);
	});

	it('rejects weekStartsOn out of range', () => {
		expect(preferencesUpdateSchema.safeParse({ ...valid, weekStartsOn: 7 }).success).toBe(false);
		expect(preferencesUpdateSchema.safeParse({ ...valid, weekStartsOn: -1 }).success).toBe(false);
	});

	it('rejects empty currency or locale', () => {
		expect(preferencesUpdateSchema.safeParse({ ...valid, currency: '' }).success).toBe(false);
		expect(preferencesUpdateSchema.safeParse({ ...valid, locale: '' }).success).toBe(false);
	});
});
