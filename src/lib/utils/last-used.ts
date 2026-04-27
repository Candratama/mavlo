import type { TransactionKind } from '$lib/validation/transaction.js';

const KEY = 'mavlo:last-used';

export type LastUsed = {
	accountId?: string;
	kind?: TransactionKind;
};

export function getLastUsed(): LastUsed {
	if (typeof window === 'undefined') return {};
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return typeof parsed === 'object' && parsed !== null ? (parsed as LastUsed) : {};
	} catch {
		return {};
	}
}

export function setLastUsed(next: Partial<LastUsed>): void {
	if (typeof window === 'undefined') return;
	try {
		const current = getLastUsed();
		const merged = { ...current, ...next };
		window.localStorage.setItem(KEY, JSON.stringify(merged));
	} catch {
		// Ignore quota / privacy-mode errors
	}
}
