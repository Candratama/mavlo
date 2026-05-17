<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import { CreditCard, Wallet, Car, Home, Tag } from 'lucide-svelte';
	import { notify } from '$lib/utils/toast.js';
	import { parseAprToInt, formatApr } from '$lib/utils/debt';

	type DebtRow = {
		id: string;
		name: string;
		type: 'credit_card' | 'kta' | 'kpr' | 'auto' | 'bnpl' | 'pinjol' | 'informal' | 'other';
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
		creditAccounts,
		onClose
	}: {
		mode: 'create' | 'edit';
		initial: DebtRow | null;
		creditAccounts: Account[];
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
		{ value: 'informal', label: 'Informal (family/friend)', icon: toIcon(Wallet) },
		{ value: 'other', label: 'Other', icon: toIcon(Wallet) }
	];

	// State
	let name = $state(initial?.name ?? '');
	let type = $state<DebtRow['type']>(initial?.type ?? 'credit_card');
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

	const interestRatePctInt = $derived(parseAprToInt(aprDisplay) ?? 0);
	const startDateMs = $derived(startDateStr ? new Date(startDateStr).getTime() : 0);
	const maturityDateMs = $derived(maturityDateStr ? new Date(maturityDateStr).getTime() : null);

	const showDueDay = $derived(type !== 'bnpl' && type !== 'informal');
	const showLinkedAccount = $derived(type === 'credit_card');
	const showMaturityDate = $derived(type === 'kpr' || type === 'auto' || type === 'bnpl');
	const principalLabel = $derived(type === 'credit_card' ? 'Credit limit' : 'Principal');

	const accountItems = $derived<PickerItem[]>(
		creditAccounts.map((a) => ({ value: a.id, label: a.name, icon: toIcon(CreditCard) }))
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
	{#if maturityDateMs}
		<input type="hidden" name="maturityDate" value={maturityDateMs} />
	{/if}

	<div class="space-y-1">
		<Label for="debt-name">Name</Label>
		<Input id="debt-name" name="name" bind:value={name} required maxlength={100} />
	</div>

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
		<Label for="debt-lender">Lender (optional)</Label>
		<Input id="debt-lender" name="lender" bind:value={lender} maxlength={100} />
	</div>

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

	<div class="grid grid-cols-2 gap-3">
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
		<div class="space-y-1">
			<Label for="debt-min">Min payment</Label>
			<MoneyInput
				id="debt-min"
				name="minimumPaymentCents"
				min={0}
				bind:value={minimumPaymentCents}
				class="h-12 text-lg md:h-12 md:text-lg"
			/>
		</div>
	</div>

	{#if showDueDay}
		<div class="space-y-1">
			<Label for="debt-due">Due day (1–31)</Label>
			<Input id="debt-due" type="number" name="dueDay" min={1} max={31} bind:value={dueDay} />
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-3">
		<div class="space-y-1">
			<Label for="debt-start">Start date</Label>
			<Input id="debt-start" type="date" bind:value={startDateStr} required />
		</div>
		{#if showMaturityDate}
			<div class="space-y-1">
				<Label for="debt-maturity">Maturity date</Label>
				<Input id="debt-maturity" type="date" bind:value={maturityDateStr} />
			</div>
		{/if}
	</div>

	{#if showLinkedAccount && creditAccounts.length > 0}
		<div class="space-y-1">
			<Label>Linked account (optional)</Label>
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
		<Label for="debt-note">Note (optional)</Label>
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
