type State = {
	open: boolean;
	defaultKind: 'income' | 'expense' | 'transfer';
};

const state = $state<State>({ open: false, defaultKind: 'expense' });

export function openAddTransaction(defaultKind: 'income' | 'expense' | 'transfer' = 'expense') {
	state.defaultKind = defaultKind;
	state.open = true;
}

export function closeAddTransaction() {
	state.open = false;
}

export function getAddTransactionState(): State {
	return state;
}
