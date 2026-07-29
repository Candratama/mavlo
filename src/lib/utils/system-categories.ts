// Stable identifiers for app-managed ("system") categories, stored in
// categories.system_key. Resolved by key — never by name — so the user may
// rename these categories freely without breaking the features that depend on
// them. Client-safe module: imported by both server repositories and Svelte
// components.
export const SYSTEM_CATEGORY_KEYS = {
	debtPayment: 'debt_payment',
	moneyLentOut: 'money_lent_out',
	loanCollected: 'loan_collected',
	loanProceeds: 'loan_proceeds',
	adjustmentIncome: 'adjustment_income',
	adjustmentExpense: 'adjustment_expense'
} as const;

export type SystemCategoryKey = (typeof SYSTEM_CATEGORY_KEYS)[keyof typeof SYSTEM_CATEGORY_KEYS];
