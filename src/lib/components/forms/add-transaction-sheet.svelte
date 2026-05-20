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

	let kind = $state<'income' | 'expense' | 'transfer'>(initialState().kind);
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
		kind = i.kind;
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

	const activeDebts = $derived((page.data.debts ?? []).filter((d: any) => d.status === 'active'));
	const pickedDebt = $derived(activeDebts.find((d: any) => d.id === debtId));

	const debtPaymentCategory = $derived(
		categories.find((c) => c.name === 'Debt Payment' && c.kind === 'expense')
	);

	// When a debt is linked, force category to "Debt Payment" so the user
	// doesn't have to pick + budgets/reports stay consistent.
	$effect(() => {
		if (debtId && debtPaymentCategory && categoryId !== debtPaymentCategory.id) {
			categoryId = debtPaymentCategory.id;
		}
	});

	const kindOptions = [
		{ value: 'expense', label: 'Expense' },
		{ value: 'income', label: 'Income' },
		{ value: 'transfer', label: 'Transfer' }
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

	const debtItems = $derived<PickerItem[]>([
		{ value: '', label: 'None', icon: CreditCard as unknown as Icon },
		...activeDebts.map((d: any) => ({
			value: d.id,
			label: d.name,
			icon: CreditCard as unknown as Icon
		}))
	]);

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
			<SegmentedControl options={kindOptions} bind:value={kind} ariaLabel="Transaction kind" />
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

		{#if kind === 'expense' && activeDebts.length > 0}
			<div class="space-y-2">
				<Label>Link to debt <span class="text-muted-foreground font-normal">(optional)</span></Label>
				<PickerSheet
					items={debtItems}
					bind:value={debtId}
					name="debtId"
					placeholder="None"
					title="Link to debt"
					usePopover={!isDesktop.current}
				/>
				{#if pickedDebt}
					<p class="text-muted-foreground text-xs">Will reduce {pickedDebt.name} balance</p>
				{/if}
			</div>
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
	<Dialog.Root bind:open>
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
