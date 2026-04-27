import type { Component } from 'svelte';
import {
	Utensils,
	ShoppingCart,
	Car,
	Home,
	Coffee,
	Plane,
	Heart,
	Gift,
	Smartphone,
	Book,
	Music,
	Film,
	Wallet,
	CreditCard,
	Banknote,
	PiggyBank,
	Briefcase,
	GraduationCap,
	Dumbbell,
	Pill,
	Fuel,
	ShoppingBag,
	Bus,
	Bike,
	Tag,
	Receipt,
	Wifi,
	Tv,
	Shirt,
	Baby,
	PawPrint,
	Hammer,
	Sparkles
} from 'lucide-svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IconComponent = Component<any> | (new (...args: any[]) => any);

export const CATEGORY_ICONS: { name: string; label: string; icon: IconComponent }[] = [
	{ name: 'utensils', label: 'Food', icon: Utensils },
	{ name: 'coffee', label: 'Coffee', icon: Coffee },
	{ name: 'shopping-cart', label: 'Groceries', icon: ShoppingCart },
	{ name: 'shopping-bag', label: 'Shopping', icon: ShoppingBag },
	{ name: 'shirt', label: 'Clothing', icon: Shirt },
	{ name: 'gift', label: 'Gifts', icon: Gift },
	{ name: 'home', label: 'Home', icon: Home },
	{ name: 'wifi', label: 'Internet', icon: Wifi },
	{ name: 'tv', label: 'Subscriptions', icon: Tv },
	{ name: 'smartphone', label: 'Phone', icon: Smartphone },
	{ name: 'car', label: 'Car', icon: Car },
	{ name: 'fuel', label: 'Fuel', icon: Fuel },
	{ name: 'bus', label: 'Transit', icon: Bus },
	{ name: 'bike', label: 'Bike', icon: Bike },
	{ name: 'plane', label: 'Travel', icon: Plane },
	{ name: 'heart', label: 'Health', icon: Heart },
	{ name: 'pill', label: 'Pharmacy', icon: Pill },
	{ name: 'dumbbell', label: 'Fitness', icon: Dumbbell },
	{ name: 'baby', label: 'Kids', icon: Baby },
	{ name: 'paw-print', label: 'Pets', icon: PawPrint },
	{ name: 'book', label: 'Education', icon: Book },
	{ name: 'graduation-cap', label: 'School', icon: GraduationCap },
	{ name: 'music', label: 'Music', icon: Music },
	{ name: 'film', label: 'Entertainment', icon: Film },
	{ name: 'sparkles', label: 'Personal', icon: Sparkles },
	{ name: 'hammer', label: 'Repair', icon: Hammer },
	{ name: 'receipt', label: 'Bills', icon: Receipt },
	{ name: 'banknote', label: 'Cash', icon: Banknote },
	{ name: 'wallet', label: 'Wallet', icon: Wallet },
	{ name: 'credit-card', label: 'Card', icon: CreditCard },
	{ name: 'piggy-bank', label: 'Savings', icon: PiggyBank },
	{ name: 'briefcase', label: 'Work', icon: Briefcase },
	{ name: 'tag', label: 'Other', icon: Tag }
];

export function getIconByName(name: string | null | undefined): IconComponent | null {
	if (!name) return null;
	return CATEGORY_ICONS.find((i) => i.name === name)?.icon ?? null;
}
