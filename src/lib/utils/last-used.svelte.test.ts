import { describe, it, expect, beforeEach } from 'vitest';
import { getLastUsed, setLastUsed } from './last-used';

describe('last-used', () => {
	beforeEach(() => {
		if (typeof localStorage !== 'undefined') localStorage.clear();
	});

	it('returns empty object when no value stored', () => {
		expect(getLastUsed()).toEqual({});
	});

	it('roundtrips kind and accountId', () => {
		setLastUsed({ accountId: 'acct-1', kind: 'expense' });
		expect(getLastUsed()).toEqual({ accountId: 'acct-1', kind: 'expense' });
	});

	it('partial set merges with existing', () => {
		setLastUsed({ accountId: 'acct-1', kind: 'expense' });
		setLastUsed({ kind: 'income' });
		expect(getLastUsed()).toEqual({ accountId: 'acct-1', kind: 'income' });
	});

	it('returns empty object for malformed JSON', () => {
		localStorage.setItem('mavlo:last-used', '{not-json');
		expect(getLastUsed()).toEqual({});
	});
});
