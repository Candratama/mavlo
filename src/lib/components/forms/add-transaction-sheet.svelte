<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import MoneyInput from './money-input.svelte';
	import SubmitButton from './submit-button.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import DatePicker from '$lib/components/ui/date-picker.svelte';
	import {
		StickyNote,
		Trash2,
		Coins,
		Landmark,
		CreditCard,
		Wallet,
		PiggyBank,
		CircleEllipsis,
		Tag
	} from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import { setLastUsed } from '$lib/utils/last-used.js';
	import { notify } from '$lib/utils/toast.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';

	type Account = {
		id: string;
		name: string;
		currency: string;
		balanceCents?: number;
		type?: string;
	};
	type Category = {
		id: string;
		name: string;
		kind: 'income' | 'expense';
		icon?: string | null;
	};
	type EditTarget = {
		id: string;
		kind: 'income' | 'expense' | 'transfer';
		amountCents: number;
		accountId: string;
		transferToAccountId: string | null;
		categoryId: string | null;
		debtId?: string | null;
		occurredAt: number;
		note: string | null;
	};

	type Props = {
		open: boolean;
		mode: 'create' | 'edit';
		accounts: Account[];
		categories: Category[];
		defaultKind?: 'income' | 'expense' | 'transfer';
		defaultAccountId?: string;
		editTarget?: EditTarget | null;
		debtTarget?: { id: string; name: string; minimumPaymentCents: number } | null;
		actionUrl: string;
		onClose: () => void;
		onSuccess?: () => void;
	};

	let {
		open = $bindable(),
		mode,
		accounts,
		categories,
		defaultKind = 'expense',
		defaultAccountId,
		editTarget = null,
		debtTarget = null,
		actionUrl,
		onClose,
		onSuccess
	}: Props = $props();

	const todayYmd = new Date().toISOString().slice(0, 10);

	function initialState() {
		if (mode === 'edit' && editTarget) {
			return {
				kind: editTarget.kind,
				accountId: editTarget.accountId,
				transferToAccountId: editTarget.transferToAccountId ?? '',
				categoryId: editTarget.categoryId ?? '',
				debtId: editTarget.debtId ?? '',
				occurredAt: new Date(editTarget.occurredAt).toISOString().slice(0, 10),
				note: editTarget.note ?? ''
			};
		}
		const resolvedKind = debtTarget ? 'expense' : defaultKind;
		const validSources =
			resolvedKind === 'transfer' ? accounts : accounts.filter((a) => a.type !== 'savings');
		const resolvedAccountId = validSources.some((a) => a.id === defaultAccountId)
			? (defaultAccountId ?? '')
			: (validSources[0]?.id ?? '');
		return {
			kind: resolvedKind,
			accountId: resolvedAccountId,
			transferToAccountId: '',
			categoryId: '',
			debtId: debtTarget?.id ?? '',
			occurredAt: todayYmd,
			note: ''
		};
	}

	let uiKind = $state<'income' | 'expense' | 'transfer' | 'debt'>(
		debtTarget ? 'debt' : initialState().kind
	);
	// Sub-action within Debt tab. Determined by picked debt direction when set,
	// else default 'repay'. User can switch via the sub-action buttons.
	let debtSubAction = $state<'repay' | 'collect'>('repay');
	let accountId = $state(initialState().accountId);
	let transferToAccountId = $state(initialState().transferToAccountId);
	let categoryId = $state(initialState().categoryId);
	let debtId = $state(initialState().debtId);
	let occurredAt = $state(initialState().occurredAt);
	let note = $state(initialState().note);
	let showNote = $state(initialState().note.length > 0);
	let pending = $state(false);
	let amountCents = $state<number | null>(
		debtTarget
			? debtTarget.minimumPaymentCents
			: (editTarget?.amountCents ?? null)
	);

	const activeDebts = $derived((page.data.debts ?? []).filter((d: any) => d.status === 'active'));
	const borrowedDebts = $derived(
		activeDebts.filter((d: any) => (d.direction ?? 'borrowed') === 'borrowed')
	);
	const lentDebts = $derived(activeDebts.filter((d: any) => d.direction === 'lent'));
	const pickedDebt = $derived(activeDebts.find((d: any) => d.id === debtId));
	// Map 'debt' UI mode to underlying kind based on sub-action.
	//   repay (I owe → pay) → expense
	//   collect (they owe → receive) → income
	const kind = $derived<'income' | 'expense' | 'transfer'>(
		uiKind === 'debt' ? (debtSubAction === 'collect' ? 'income' : 'expense') : uiKind
	);

	const sourceAccount = $derived(accounts.find((a) => a.id === accountId));
	const sourceBalanceCents = $derived(sourceAccount?.balanceCents);
	const oldOwnEffectCents = $derived.by(() => {
		// Refund old effect when editing the same source account
		if (mode !== 'edit' || !editTarget) return 0;
		if (editTarget.accountId !== accountId) return 0;
		if (editTarget.kind === 'expense' || editTarget.kind === 'transfer')
			return editTarget.amountCents;
		if (editTarget.kind === 'income') return -editTarget.amountCents;
		return 0;
	});
	const availableBalanceCents = $derived(
		sourceBalanceCents !== undefined ? sourceBalanceCents + oldOwnEffectCents : undefined
	);
	const exceedsBalance = $derived(
		(kind === 'expense' || kind === 'transfer') &&
			amountCents !== null &&
			availableBalanceCents !== undefined &&
			amountCents > availableBalanceCents
	);

	$effect(() => {
		if (!open) return;
		const i = initialState();
		uiKind = debtTarget ? 'debt' : i.kind;
		if (debtTarget) {
			const td = activeDebts.find((d: any) => d.id === debtTarget.id);
			debtSubAction = td?.direction === 'lent' ? 'collect' : 'repay';
		}
		accountId = i.accountId;
		transferToAccountId = i.transferToAccountId;
		categoryId = i.categoryId;
		debtId = i.debtId;
		occurredAt = i.occurredAt;
		note = i.note;
		showNote = i.note.length > 0;
		amountCents = debtTarget
			? debtTarget.minimumPaymentCents
			: mode === 'edit' && editTarget
				? editTarget.amountCents
				: null;
	});

	// When a debt is picked, prefill amount if currently empty/0
	$effect(() => {
		if (!debtId) return;
		const picked = activeDebts.find((d: any) => d.id === debtId);
		if (!picked) return;
		if (!amountCents || amountCents === 0) {
			amountCents = picked.minimumPaymentCents;
		}
	});

	const debtPaymentCategory = $derived(
		categories.find((c) => c.name === 'Debt Payment' && c.kind === 'expense')
	);
	const loanCollectedCategory = $derived(
		categories.find((c) => c.name === 'Loan Collected' && c.kind === 'income')
	);

	// When a debt is linked, force category to the correct auto-category based
	// on direction (borrowed → Debt Payment, lent → Loan Collected). If the
	// category doesn't exist client-side yet, server lazily creates it.
	$effect(() => {
		if (!debtId) return;
		const target =
			pickedDebt?.direction === 'lent' ? loanCollectedCategory : debtPaymentCategory;
		if (target && categoryId !== target.id) {
			categoryId = target.id;
		}
	});

	const kindOptions = [
		{ value: 'expense', label: 'Expense' },
		{ value: 'income', label: 'Income' },
		{ value: 'transfer', label: 'Transfer' },
		{ value: 'debt', label: 'Debt' }
	];

	type Icon = PickerItem['icon'];
	const accountTypeIcon: Record<string, Icon> = {
		cash: Coins as unknown as Icon,
		bank: Landmark as unknown as Icon,
		credit: CreditCard as unknown as Icon,
		wallet: Wallet as unknown as Icon,
		savings: PiggyBank as unknown as Icon,
		other: CircleEllipsis as unknown as Icon
	};
	const fallbackAccountIcon = Wallet as unknown as Icon;
	const fallbackCategoryIcon = Tag as unknown as Icon;

	// Savings accounts: transfer-only. Hide from source picker for income/expense.
	const sourceAccounts = $derived(
		accounts.filter((a) => kind === 'transfer' || a.type !== 'savings')
	);
	const accountItems = $derived<PickerItem[]>(
		sourceAccounts.map((a) => ({
			value: a.id,
			label: a.name,
			description:
				a.balanceCents !== undefined ? formatCentsAsCurrency(a.balanceCents, a.currency) : '',
			icon: (a.type && accountTypeIcon[a.type]) || fallbackAccountIcon
		}))
	);
	const allAccountItems = $derived<PickerItem[]>(
		accounts.map((a) => ({
			value: a.id,
			label: a.name,
			description:
				a.balanceCents !== undefined ? formatCentsAsCurrency(a.balanceCents, a.currency) : '',
			icon: (a.type && accountTypeIcon[a.type]) || fallbackAccountIcon
		}))
	);

	$effect(() => {
		const valid = new Set(sourceAccounts.map((a) => a.id));
		if (accountId && !valid.has(accountId)) {
			accountId = sourceAccounts[0]?.id ?? '';
		}
	});

	const categoryItems = $derived<PickerItem[]>([
		{ value: '', label: 'None', icon: fallbackCategoryIcon },
		...categories
			.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'))
			.map((c) => ({
				value: c.id,
				label: c.name,
				icon: (getIconByName(c.icon) as unknown as Icon) ?? fallbackCategoryIcon
			}))
	]);

	$effect(() => {
		const ids = new Set(categoryItems.map((i) => i.value));
		if (categoryId && !ids.has(categoryId)) categoryId = '';
	});

	// Filter pool by sub-action: repay shows borrowed debts, collect shows lent.
	const debtPool = $derived(debtSubAction === 'collect' ? lentDebts : borrowedDebts);
	const debtItems = $derived<PickerItem[]>([
		{ value: '', label: 'None', icon: CreditCard as unknown as Icon },
		...debtPool.map((d: any) => ({
			value: d.id,
			label: d.name,
			icon: CreditCard as unknown as Icon
		}))
	]);
	// Reset debtId if it no longer matches the current pool when sub-action flips.
	$effect(() => {
		if (uiKind !== 'debt') return;
		if (debtId && !debtPool.some((d: any) => d.id === debtId)) {
			debtId = '';
		}
	});

	const isToday = $derived(occurredAt === todayYmd);
	const dateLabel = $derived.by(() => {
		if (isToday) return 'Today';
		if (!occurredAt) return 'Pick date';
		const d = new Date(`${occurredAt}T00:00:00`);
		if (Number.isNaN(d.getTime())) return 'Pick date';
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	});

	function onClosed() {
		open = false;
		onClose();
	}

	const isDesktop = new MediaQuery('(min-width: 768px)');
</script>

{#snippet body()}
	<form
		method="POST"
		action={actionUrl}
		use:enhance={() => {
			pending = true;
			return async ({ result }) => {
				pending = false;
				if (result.type === 'success') {
					const isSavingsSource = sourceAccount?.type === 'savings';
					setLastUsed(isSavingsSource ? { kind } : { accountId, kind });
					await invalidateAll();
					await onSuccess?.();
					notify.success(mode === 'create' ? 'Transaction added' : 'Transaction updated');
					onClosed();
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not save transaction');
				}
			};
		}}
		class="space-y-4 px-4 pb-4"
	>
		{#if mode === 'edit' && editTarget}
			<input type="hidden" name="id" value={editTarget.id} />
		{/if}

		{#if mode === 'create'}
			<SegmentedControl options={kindOptions} bind:value={uiKind} ariaLabel="Transaction kind" />
		{/if}
		<input type="hidden" name="kind" value={kind} />

		<div class="space-y-1">
			<div class="text-muted-foreground text-xs">
				{sourceAccount?.currency ?? 'IDR'}
			</div>
			<MoneyInput
				name="amountCents"
				bind:value={amountCents}
				min={1}
				required
				placeholder="0"
				class={`h-14 text-3xl font-semibold md:h-12 md:text-2xl ${exceedsBalance ? 'border-destructive focus-visible:border-destructive' : ''}`}
			/>
			{#if exceedsBalance}
				<p class="text-destructive text-xs">Insufficient balance in source account.</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<DatePicker
				variant="pill"
				name="occurredAt"
				bind:value={occurredAt}
				placeholder="Pick date"
				title="Date"
				label={dateLabel}
			/>
			{#if !showNote}
				<button
					type="button"
					onclick={() => (showNote = true)}
					class="border-input text-muted-foreground hover:bg-accent/30 inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm md:h-9 md:px-3"
				>
					<StickyNote class="size-4" />
					Add note
				</button>
			{/if}
		</div>

		{#if showNote}
			<div class="space-y-1">
				<Label for="tx-note">Note</Label>
				<div class="flex items-center gap-2">
					<Input
						id="tx-note"
						name="note"
						bind:value={note}
						maxlength={200}
						placeholder="Optional"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onclick={() => {
							note = '';
							showNote = false;
						}}
						aria-label="Remove note"
					>
						<Trash2 class="size-4" />
					</Button>
				</div>
			</div>
		{/if}

		<div class="space-y-2">
			<Label>{kind === 'transfer' ? 'From account' : 'Account'}</Label>
			<PickerSheet
				items={accountItems}
				bind:value={accountId}
				name="accountId"
				placeholder="Choose account"
				title="Select account"
				showSelectedDescription
				usePopover={!isDesktop.current}
			/>
		</div>

		{#if kind === 'transfer'}
			<div class="space-y-2">
				<Label>To account</Label>
				<PickerSheet
					items={allAccountItems.filter((i) => i.value !== accountId)}
					bind:value={transferToAccountId}
					name="transferToAccountId"
					placeholder="Choose destination"
					title="Select destination"
					showSelectedDescription
					usePopover={!isDesktop.current}
				/>
			</div>
		{:else if !debtId}
			<div class="space-y-2">
				<Label>Category</Label>
				<PickerSheet
					items={categoryItems}
					bind:value={categoryId}
					name="categoryId"
					placeholder="None"
					title="Select category"
					searchable
					usePopover={!isDesktop.current}
				/>
			</div>
		{:else}
			<input type="hidden" name="categoryId" value={categoryId} />
		{/if}

		{#if uiKind === 'debt'}
			<div class="space-y-2">
				<Label>Action</Label>
				<div class="grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={() => (debtSubAction = 'repay')}
						class="rounded-lg border p-3 text-left transition-colors {debtSubAction === 'repay'
							? 'border-primary bg-primary/10'
							: 'hover:bg-accent'}"
					>
						<div class="text-sm font-medium">Repay</div>
						<div class="text-muted-foreground text-xs">Pay money I owe</div>
					</button>
					<button
						type="button"
						onclick={() => (debtSubAction = 'collect')}
						class="rounded-lg border p-3 text-left transition-colors {debtSubAction ===
						'collect'
							? 'border-primary bg-primary/10'
							: 'hover:bg-accent'}"
					>
						<div class="text-sm font-medium">Collect</div>
						<div class="text-muted-foreground text-xs">Receive money owed to me</div>
					</button>
				</div>
				<div class="text-muted-foreground mt-1 text-xs">
					Need a new debt? <a href="/debts" class="text-primary underline">Add it on Debts page</a>
					to also borrow or lend.
				</div>
			</div>
			{#if debtPool.length > 0}
				<div class="space-y-2">
					<Label>{debtSubAction === 'collect' ? 'Collect from' : 'Pay debt'}</Label>
					<PickerSheet
						items={debtItems}
						bind:value={debtId}
						name="debtId"
						placeholder="Pick debt"
						title={debtSubAction === 'collect' ? 'Collect from' : 'Pay debt'}
						usePopover={!isDesktop.current}
					/>
					{#if pickedDebt}
						<p class="text-muted-foreground text-xs">Will reduce {pickedDebt.name} balance</p>
					{/if}
				</div>
			{:else}
				<input type="hidden" name="debtId" value="" />
				<p class="text-muted-foreground text-xs">
					No {debtSubAction === 'collect' ? 'lent' : 'borrowed'} debts.
					<a href="/debts" class="text-primary underline">Add one</a>.
				</p>
			{/if}
		{:else}
			<input type="hidden" name="debtId" value="" />
		{/if}

		<div class="flex gap-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-0">
			<Button
				type="button"
				variant="outline"
				onclick={onClosed}
				class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
			>
				Cancel
			</Button>
			<SubmitButton
				{pending}
				disabled={exceedsBalance}
				class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
			>
				Save
			</SubmitButton>
		</div>
	</form>
{/snippet}

{#if isDesktop.current}
	 5<Dialog.Root bind:open>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{mode === 'create' ? 'New transaction' : 'Edit transaction'}</Dialog.Title>
			</Dialog.Header>
			{@render body()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left">
				<Sheet.Title>{mode === 'create' ? 'New transaction' : 'Edit transaction'}</Sheet.Title>
			</Sheet.Header>
			<div class="flex-1 overflow-y-auto">
				{@render body()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
