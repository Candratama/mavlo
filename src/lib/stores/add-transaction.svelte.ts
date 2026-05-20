type DebtTarget = {
	id: string;
	name: string;
	minimumPaymentCents: number;
} | null;

type State = {
	open: boolean;
	defaultKind: 'income' | 'expense' | 'transfer';
	debtTarget: DebtTarget;
};

const state = $state<State>({ open: false, defaultKind: 'expense', debtTarget: null });

export function openAddTransaction(opts?: {
	defaultKind?: 'income' | 'expense' | 'transfer';
	debtTarget?: DebtTarget;
}) {
	state.defaultKind = opts?.defaultKind ?? 'expense';
	state.debtTarget = opts?.debtTarget ?? null;
	state.open = true;
}

export function closeAddTransaction() {
	state.open = false;
	state.debtTarget = null;
}

export function getAddTransactionState(): State {
	return state;
}
