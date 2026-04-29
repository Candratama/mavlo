import type { CategoryKind } from '$lib/validation/category';

export type DefaultCategory = {
	name: string;
	kind: CategoryKind;
	icon: string;
	color: string;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
	{ name: 'Makan', kind: 'expense', icon: 'utensils', color: '#f59e0b' },
	{ name: 'Transport', kind: 'expense', icon: 'car', color: '#3b82f6' },
	{ name: 'Belanja', kind: 'expense', icon: 'shopping-bag', color: '#ec4899' },
	{ name: 'Tagihan', kind: 'expense', icon: 'receipt', color: '#ef4444' },
	{ name: 'Hiburan', kind: 'expense', icon: 'film', color: '#a855f7' },
	{ name: 'Kesehatan', kind: 'expense', icon: 'heart-pulse', color: '#10b981' },
	{ name: 'Gaji', kind: 'income', icon: 'briefcase', color: '#22c55e' },
	{ name: 'Bonus', kind: 'income', icon: 'gift', color: '#14b8a6' },
	{ name: 'Lainnya', kind: 'income', icon: 'hand-coins', color: '#06b6d4' }
];
