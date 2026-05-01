import type { CategoryKind } from '$lib/validation/category';

export type DefaultCategory = {
	name: string;
	kind: CategoryKind;
	icon: string;
	color: string;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
	{ name: 'Food', kind: 'expense', icon: 'utensils', color: '#f59e0b' },
	{ name: 'Transport', kind: 'expense', icon: 'car', color: '#3b82f6' },
	{ name: 'Shopping', kind: 'expense', icon: 'shopping-bag', color: '#ec4899' },
	{ name: 'Bills', kind: 'expense', icon: 'receipt', color: '#ef4444' },
	{ name: 'Entertainment', kind: 'expense', icon: 'film', color: '#a855f7' },
	{ name: 'Health', kind: 'expense', icon: 'heart-pulse', color: '#10b981' },
	{ name: 'Salary', kind: 'income', icon: 'briefcase', color: '#22c55e' },
	{ name: 'Bonus', kind: 'income', icon: 'gift', color: '#14b8a6' },
	{ name: 'Other', kind: 'income', icon: 'hand-coins', color: '#06b6d4' }
];
