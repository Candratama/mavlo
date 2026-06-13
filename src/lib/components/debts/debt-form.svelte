<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import { CreditCard, Wallet, Car, Home, Tag, User as UserIcon } from 'lucide-svelte';
	import { notify } from '$lib/utils/toast.js';
	import { parseAprToInt, formatApr } from '$lib/utils/debt';

	type DebtType = 'credit_card' | 'kta' | 'kpr' | 'auto' | 'bnpl' | 'pinjol' | 'informal' | 'other';

	type DebtRow = {
		id: string;
		name: string;
		type: DebtType;
		lender: string | null;
		principalCents: number;
		currentBalanceCents: number;
		interestRatePct: number;
		minimumPaymentCents: number;
		dueDay: number | null;
		startDate: number;
		maturityDate: number | null;
		status: 'active' | 'paid_off' | 'in_arrears';
		accountId: string | null;
		direction: 'borrowed' | 'lent';
		note: string | null;
	};

	type Account = {
		id: string;
		name: string;
		type: string;
	};

	let {
		mode,
		initial,
		accounts,
		onClose
	}: {
		mode: 'create' | 'edit';
		initial: DebtRow | null;
		accounts: Account[];
		onClose: () => void;
	} = $props();

	type Icon = PickerItem['icon'];
	const toIcon = (i: unknown) => i as Icon;

	const typeItems: PickerItem[] = [
		{ value: 'credit_card', label: 'Credit card', icon: toIcon(CreditCard) },
		{ value: 'kta', label: 'Personal loan (KTA)', icon: toIcon(Wallet) },
		{ value: 'kpr', label: 'Mortgage (KPR)', icon: toIcon(Home) },
		{ value: 'auto', label: 'Auto loan', icon: toIcon(Car) },
		{ value: 'bnpl', label: 'Buy now pay later (BNPL)', icon: toIcon(Tag) },
		{ value: 'pinjol', label: 'Online lending (Pinjol)', icon: toIcon(Wallet) },
		{ value: 'informal', label: 'Informal (family/friend)', icon: toIcon(UserIcon) },
		{ value: 'other', label: 'Other', icon: toIcon(Wallet) }
	];

	// State
	let direction = $state<'borrowed' | 'lent'>(initial?.direction ?? 'borrowed');
	let name = $state(initial?.name ?? '');
	let type = $state<DebtType>(initial?.type ?? (direction === 'lent' ? 'informal' : 'credit_card'));
	let lender = $state(initial?.lender ?? '');
	let principalCents = $state<number | null>(initial?.principalCents ?? null);
	let currentBalanceCents = $state<number | null>(initial?.currentBalanceCents ?? null);
	let aprDisplay = $state(initial ? formatApr(initial.interestRatePct).replace('%', '') : '');
	let minimumPaymentCents = $state<number | null>(initial?.minimumPaymentCents ?? null);
	let dueDay = $state<number | null>(initial?.dueDay ?? null);
	let startDateStr = $state(
		initial
			? new Date(initial.startDate).toISOString().slice(0, 10)
			: new Date().toISOString().slice(0, 10)
	);
	let maturityDateStr = $state(
		initial?.maturityDate ? new Date(initial.maturityDate).toISOString().slice(0, 10) : ''
	);
	let accountId = $state(initial?.accountId ?? '');
	let note = $state(initial?.note ?? '');
	let pending = $state(false);

	// Funding toggle (create mode only): "I just received this money"
	let funded = $state(false);
	let fundedAccountId = $state('');

	// When user toggles funded on, auto-fill currentBalance = principal so they
	// don't have to type the same number twice.
	$effect(() => {
		if (
			funded &&
			principalCents != null &&
			(currentBalanceCents == null || currentBalanceCents === 0)
		) {
			currentBalanceCents = principalCents;
		}
	});

	const interestRatePctInt = $derived(parseAprToInt(aprDisplay) ?? 0);
	const startDateMs = $derived(startDateStr ? new Date(startDateStr).getTime() : 0);
	const maturityDateMs = $derived(maturityDateStr ? new Date(maturityDateStr).getTime() : null);

	const isLent = $derived(direction === 'lent');
	const isInformal = $derived(type === 'informal');

	const showDueDay = $derived(!isLent && type !== 'bnpl' && type !== 'informal');
	const dueDayExpected = $derived(
		!isLent &&
			(type === 'credit_card' ||
				type === 'kta' ||
				type === 'kpr' ||
				type === 'auto' ||
				type === 'pinjol')
	);
	const showLinkedAccount = $derived(!isLent && type === 'credit_card');
	const showMaturityDate = $derived(
		!isLent && (type === 'kpr' || type === 'auto' || type === 'bnpl')
	);
	const showApr = $derived(!isLent && type !== 'informal');
	const showMinPayment = $derived(!isLent);
	const showFundingToggle = $derived(mode === 'create' && type !== 'credit_card');

	const principalLabel = $derived(
		isLent ? 'Amount lent' : type === 'credit_card' ? 'Credit limit' : 'Amount borrowed'
	);
	const lenderLabel = $derived(
		isLent
			? 'Person you lent to'
			: isInformal
				? 'Person you owe'
				: type === 'other'
					? 'Lender / source'
					: 'Lender'
	);
	const namePlaceholder = $derived.by(() => {
		switch (type) {
			case 'credit_card':
				return 'e.g., BCA Visa';
			case 'kta':
				return 'e.g., KTA BRI';
			case 'kpr':
				return 'e.g., KPR rumah';
			case 'auto':
				return 'e.g., Mobil avanza';
			case 'bnpl':
				return 'e.g., Shopee PayLater';
			case 'pinjol':
				return 'e.g., Akulaku';
			case 'informal':
				return 'e.g., Pinjam mas Andre';
			default:
				return '';
		}
	});
	const lenderPlaceholder = $derived.by(() => {
		switch (type) {
			case 'credit_card':
			case 'kta':
			case 'kpr':
				return 'e.g., Bank BCA';
			case 'auto':
				return 'e.g., Adira Finance';
			case 'bnpl':
				return 'e.g., Shopee';
			case 'pinjol':
				return 'e.g., Akulaku';
			case 'informal':
				return 'e.g., Mas Andre';
			default:
				return '';
		}
	});

	const creditAccounts = $derived(accounts.filter((a) => a.type === 'credit'));
	const fundingAccounts = $derived(accounts.filter((a) => a.type !== 'credit'));

	const accountItems = $derived<PickerItem[]>(
		creditAccounts.map((a) => ({ value: a.id, label: a.name, icon: toIcon(CreditCard) }))
	);
	const fundingItems = $derived<PickerItem[]>(
		fundingAccounts.map((a) => ({ value: a.id, label: a.name, icon: toIcon(Wallet) }))
	);
</script>

<form
	method="POST"
	action={mode === 'create' ? '/debts?/create' : '/debts?/update'}
	use:enhance={() => {
		pending = true;
		return async ({ result }) => {
			pending = false;
			if (result.type === 'success') {
				await invalidateAll();
				onClose();
				notify.success(mode === 'create' ? 'Debt added' : 'Debt updated');
			} else if (result.type === 'failure') {
				const message = (result.data as { message?: string } | undefined)?.message;
				notify.error(message ?? 'Save failed');
			}
		};
	}}
	class="space-y-4 p-4"
>
	{#if mode === 'edit' && initial}
		<input type="hidden" name="id" value={initial.id} />
	{/if}
	<input type="hidden" name="interestRatePct" value={interestRatePctInt} />
	<input type="hidden" name="startDate" value={startDateMs} />
	<input type="hidden" name="direction" value={direction} />
	{#if maturityDateMs}
		<input type="hidden" name="maturityDate" value={maturityDateMs} />
	{/if}

	{#if mode === 'create'}
		<div class="space-y-1">
			<Label>Direction</Label>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (direction = 'borrowed')}
					class="rounded-lg border p-3 text-left transition-colors {direction === 'borrowed'
						? 'border-primary bg-primary/10'
						: 'hover:bg-accent'}"
				>
					<div class="text-sm font-medium">I owe</div>
					<div class="text-muted-foreground text-xs">I borrowed money</div>
				</button>
				<button
					type="button"
					onclick={() => (direction = 'lent')}
					class="rounded-lg border p-3 text-left transition-colors {direction === 'lent'
						? 'border-primary bg-primary/10'
						: 'hover:bg-accent'}"
				>
					<div class="text-sm font-medium">They owe</div>
					<div class="text-muted-foreground text-xs">I lent money to someone</div>
				</button>
			</div>
		</div>
	{/if}

	<div class="space-y-1">
		<Label>Type</Label>
		<PickerSheet
			items={typeItems}
			bind:value={type}
			name="type"
			placeholder="Pick type"
			title="Type"
		/>
	</div>

	<div class="space-y-1">
		<Label for="debt-name">Name</Label>
		<Input
			id="debt-name"
			name="name"
			bind:value={name}
			required
			maxlength={100}
			placeholder={namePlaceholder}
		/>
	</div>

	<div class="space-y-1">
		<Label for="debt-lender"
			>{lenderLabel} <span class="text-muted-foreground">(optional)</span></Label
		>
		<Input
			id="debt-lender"
			name="lender"
			bind:value={lender}
			maxlength={100}
			placeholder={lenderPlaceholder}
		/>
	</div>

	{#if showFundingToggle}
		<div class="bg-muted/30 rounded-lg border p-3">
			<label class="flex cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					bind:checked={funded}
					name="funded"
					value="1"
					class="accent-primary mt-1 size-4"
				/>
				<div class="flex-1">
					<div class="text-sm font-medium">
						{isLent ? 'I just gave this money' : 'I just received this money'}
					</div>
					<div class="text-muted-foreground text-xs">
						{#if isLent}
							Toggle on if the money left your account recently. We'll add an expense transaction.
						{:else}
							Toggle on if the funds were deposited recently. We'll add an income transaction.
						{/if}
					</div>
				</div>
			</label>
			{#if funded}
				<div class="mt-3 space-y-1">
					<Label>{isLent ? 'Money came from' : 'Money goes to'}</Label>
					{#if fundingAccounts.length === 0}
						<p class="text-muted-foreground text-xs">
							No cash/bank accounts found. Add one in Accounts first.
						</p>
					{:else}
						<PickerSheet
							items={fundingItems}
							bind:value={fundedAccountId}
							name="fundedAccountId"
							placeholder="Pick account"
							title="Account"
						/>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-3">
		<div class="space-y-1">
			<Label for="debt-principal">{principalLabel}</Label>
			<MoneyInput
				id="debt-principal"
				name="principalCents"
				min={1}
				bind:value={principalCents}
				required
				class="h-12 text-lg md:h-12 md:text-lg"
			/>
		</div>
		<div class="space-y-1">
			<Label for="debt-balance">Current balance</Label>
			<MoneyInput
				id="debt-balance"
				name="currentBalanceCents"
				min={0}
				bind:value={currentBalanceCents}
				required
				class="h-12 text-lg md:h-12 md:text-lg"
			/>
		</div>
	</div>

	{#if showApr || showMinPayment}
		<div class="grid grid-cols-2 gap-3">
			{#if showApr}
				<div class="space-y-1">
					<Label for="debt-apr">APR %</Label>
					<Input
						id="debt-apr"
						type="text"
						inputmode="decimal"
						pattern="[0-9.]*"
						bind:value={aprDisplay}
						placeholder="26.0"
					/>
				</div>
			{/if}
			{#if showMinPayment}
				<div class={showApr ? 'space-y-1' : 'col-span-2 space-y-1'}>
					<Label for="debt-min"
						>Min payment <span class="text-muted-foreground">(optional)</span></Label
					>
					<MoneyInput
						id="debt-min"
						name="minimumPaymentCents"
						min={0}
						bind:value={minimumPaymentCents}
						class="h-12 text-lg md:h-12 md:text-lg"
					/>
				</div>
			{/if}
		</div>
	{/if}

	{#if showDueDay}
		<div class="space-y-1">
			<Label for="debt-due"
				>Due day (1–31) <span class="text-muted-foreground">(optional)</span></Label
			>
			<Input id="debt-due" type="number" name="dueDay" min={1} max={31} bind:value={dueDay} />
			{#if !dueDay && dueDayExpected}
				<p class="text-xs text-amber-500">
					💡 Set due day to see upcoming payment reminders on dashboard.
				</p>
			{/if}
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-3">
		<div class="space-y-1">
			<Label for="debt-start">Start date</Label>
			<Input id="debt-start" type="date" bind:value={startDateStr} required />
		</div>
		{#if showMaturityDate}
			<div class="space-y-1">
				<Label for="debt-maturity"
					>Maturity date <span class="text-muted-foreground">(optional)</span></Label
				>
				<Input id="debt-maturity" type="date" bind:value={maturityDateStr} />
			</div>
		{/if}
	</div>

	{#if showLinkedAccount && creditAccounts.length > 0}
		<div class="space-y-1">
			<Label>Linked credit account <span class="text-muted-foreground">(optional)</span></Label>
			<PickerSheet
				items={accountItems}
				bind:value={accountId}
				name="accountId"
				placeholder="None"
				title="Account"
			/>
		</div>
	{/if}

	<div class="space-y-1">
		<Label for="debt-note">Note <span class="text-muted-foreground">(optional)</span></Label>
		<Input id="debt-note" name="note" bind:value={note} maxlength={200} />
	</div>

	<div class="flex gap-2 pt-2">
		<Button
			type="button"
			variant="outline"
			onclick={onClose}
			class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
		>
			Cancel
		</Button>
		<SubmitButton
			{pending}
			class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
		>
			{mode === 'create' ? 'Add debt' : 'Save'}
		</SubmitButton>
	</div>
</form>
