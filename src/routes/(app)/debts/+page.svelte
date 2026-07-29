<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		Plus,
		MoreHorizontal,
		Pencil,
		Trash2,
		CheckCircle2,
		CreditCard,
		Wallet,
		Car,
		Home,
		Tag,
		ChevronDown,
		ChevronUp,
		AlertTriangle
	} from 'lucide-svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import {
		paidPercent,
		formatApr,
		dtiRatio,
		dtiStatus,
		payoffProjection,
		prioritizedDebtIds,
		type PriorityStrategy
	} from '$lib/utils/debt';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import DebtForm from '$lib/components/debts/debt-form.svelte';
	import { openAddTransaction } from '$lib/stores/add-transaction.svelte.js';

	let { data } = $props();

	const isDesktop = new MediaQuery('(min-width: 768px)');

	type DebtRow = (typeof data.debts)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<DebtRow | null>(null);
	let showPaidOff = $state(false);

	const formatCents = (cents: number) => formatCentsAsCurrency(cents, 'IDR');

	const debtFormAccounts = $derived(data.allAccounts.filter((a) => !a.archived));

	const STRATEGY_KEY = 'mavlo:debtStrategy';
	let strategy = $state<PriorityStrategy>('avalanche');
	$effect(() => {
		if (typeof window === 'undefined') return;
		const stored = window.localStorage.getItem(STRATEGY_KEY);
		if (stored === 'avalanche' || stored === 'snowball') strategy = stored;
	});
	$effect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(STRATEGY_KEY, strategy);
	});

	const DIRECTION_KEY = 'mavlo:debtDirection';
	let directionTab = $state<'borrowed' | 'lent'>('borrowed');
	$effect(() => {
		if (typeof window === 'undefined') return;
		const stored = window.localStorage.getItem(DIRECTION_KEY);
		if (stored === 'borrowed' || stored === 'lent') directionTab = stored;
	});
	$effect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(DIRECTION_KEY, directionTab);
	});

	const directionOptions = [
		{ value: 'borrowed', label: 'I owe' },
		{ value: 'lent', label: 'They owe' }
	];

	const debtsInTab = $derived(
		data.debts.filter((d) => (d.direction ?? 'borrowed') === directionTab)
	);
	const hasLentDebts = $derived(data.debts.some((d) => (d.direction ?? 'borrowed') === 'lent'));

	const arrearsDebts = $derived(debtsInTab.filter((d) => d.status === 'in_arrears'));
	// Outstanding debts (active + past due) — past-due debts must stay in the
	// grid so they remain payable/editable, not just named in the banner.
	const activeDebtsRaw = $derived(debtsInTab.filter((d) => d.status !== 'paid_off'));
	const paidOffDebts = $derived(debtsInTab.filter((d) => d.status === 'paid_off'));

	const priorityOrder = $derived(prioritizedDebtIds(activeDebtsRaw, strategy));
	const activeDebts = $derived.by(() => {
		const idx = new Map(priorityOrder.map((id, i) => [id, i]));
		return [...activeDebtsRaw].sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
	});
	// "Pay first" only makes sense for a debt with an outstanding balance.
	const topPriorityDebtId = $derived.by(() => {
		const id = priorityOrder[0] ?? null;
		if (!id) return null;
		const debt = activeDebtsRaw.find((d) => d.id === id);
		return debt && debt.currentBalanceCents > 0 ? id : null;
	});

	const dti = $derived(dtiRatio(data.debtTotals.totalMinPaymentCents, data.monthIncomeCents));
	const dtiState = $derived(dtiStatus(dti));

	// Aggregate debt-free date: pick the latest payoff among all active debts.
	const aggregateFreeAtMs = $derived.by(() => {
		const now = Date.now();
		let latest = 0;
		let anyValid = false;
		for (const d of activeDebtsRaw) {
			if (d.minimumPaymentCents <= 0 || d.currentBalanceCents <= 0) continue;
			const p = payoffProjection(
				d.currentBalanceCents,
				d.minimumPaymentCents,
				d.interestRatePct,
				now
			);
			if (!p) continue;
			anyValid = true;
			if (p.freeAtMs > latest) latest = p.freeAtMs;
		}
		return anyValid ? latest : null;
	});

	const strategyOptions = [
		{ value: 'avalanche', label: 'Avalanche' },
		{ value: 'snowball', label: 'Snowball' }
	];

	const typeIcons: Record<string, typeof CreditCard> = {
		credit_card: CreditCard,
		kta: Wallet,
		kpr: Home,
		auto: Car,
		bnpl: Tag,
		pinjol: Wallet,
		informal: Wallet,
		other: Wallet
	};

	const typeLabels: Record<string, string> = {
		credit_card: 'Credit card',
		kta: 'Personal loan',
		kpr: 'Mortgage',
		auto: 'Auto loan',
		bnpl: 'BNPL',
		pinjol: 'Online lending',
		informal: 'Informal',
		other: 'Other'
	};

	const openEdit = (d: DebtRow) => {
		editTarget = d;
		editOpen = true;
	};
</script>

<svelte:head><title>Debts — Mavlo</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<h1 class="mavlo-headline text-2xl font-bold tracking-tight sm:text-3xl">Debts</h1>
	<Button class="lift" onclick={() => (createOpen = true)}>
		<Plus class="mr-1 size-4" /> Add debt
	</Button>
</div>

{#if hasLentDebts || directionTab === 'lent'}
	<div class="mb-4">
		<SegmentedControl
			options={directionOptions}
			bind:value={directionTab}
			ariaLabel="Debt direction"
		/>
	</div>
{/if}

{#if debtsInTab.length > 0}
	<div
		class="mb-6 rounded-xl border bg-gradient-to-br {directionTab === 'lent'
			? 'from-emerald-500/10'
			: dtiState === 'unsafe'
				? 'from-rose-500/10'
				: dtiState === 'moderate'
					? 'from-amber-500/10'
					: 'from-emerald-500/10'} via-card to-card p-4 sm:p-5"
	>
		<div class="mb-3 flex items-start justify-between gap-3">
			<div>
				<div class="text-muted-foreground text-xs tracking-wider uppercase">
					{directionTab === 'lent' ? 'Total receivable' : 'Total owed'}
				</div>
				<div class="mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
					{formatCents(
						directionTab === 'lent'
							? data.debtTotals.totalReceivableCents
							: data.debtTotals.totalBalanceCents
					)}
				</div>
			</div>
			{#if directionTab === 'borrowed' && dtiState === 'unsafe'}
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-500"
				>
					<AlertTriangle class="size-5" />
				</div>
			{/if}
		</div>
		{#if directionTab === 'borrowed'}
			<div class="grid grid-cols-2 gap-3 text-xs">
				<div>
					<div class="text-muted-foreground tracking-wider uppercase">Monthly minimum</div>
					<div class="mt-1 font-semibold tabular-nums">
						{formatCents(data.debtTotals.totalMinPaymentCents)}
					</div>
				</div>
				{#if data.monthIncomeCents > 0}
					<div>
						<div class="text-muted-foreground tracking-wider uppercase">DTI ratio</div>
						<div
							class="mt-1 font-semibold tabular-nums {dtiState === 'unsafe' ? 'text-expense' : ''}"
						>
							{dti}% {dtiState === 'safe' ? '✓' : dtiState === 'moderate' ? '·' : '⚠'}
						</div>
					</div>
				{/if}
			</div>
		{/if}
		{#if directionTab === 'borrowed' && aggregateFreeAtMs}
			<div class="text-muted-foreground mt-3 text-xs">
				Debt-free by
				<span class="text-foreground font-medium">
					{new Date(aggregateFreeAtMs).toLocaleDateString('en-US', {
						month: 'short',
						year: 'numeric'
					})}
				</span>
				at current payments
			</div>
		{/if}
	</div>
{/if}

{#if activeDebtsRaw.length > 1}
	<div class="mb-4 flex items-center justify-between gap-2">
		<div class="text-muted-foreground text-xs">Payoff strategy</div>
		<SegmentedControl options={strategyOptions} bind:value={strategy} ariaLabel="Strategy" />
	</div>
{/if}

{#if arrearsDebts.length > 0}
	<div class="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs">
		<div class="font-medium text-rose-500">
			⚠ {arrearsDebts.length} debt{arrearsDebts.length === 1 ? '' : 's'} past due
		</div>
		<div class="text-muted-foreground mt-1">
			{arrearsDebts.map((d) => d.name).join(', ')}. Record a payment to clear the status.
		</div>
	</div>
{/if}

<div class="grid gap-4 md:grid-cols-2">
	{#each activeDebts as debt (debt.id)}
		{@const Icon = typeIcons[debt.type] ?? Wallet}
		{@const paid = paidPercent(debt.principalCents, debt.currentBalanceCents)}
		{@const aprHigh = debt.interestRatePct > 2000}
		{@const isTopPriority = debt.id === topPriorityDebtId && activeDebtsRaw.length > 1}
		<Card.Root class="relative {isTopPriority ? 'border-primary/50 ring-primary/30 ring-1' : ''}">
			<a
				href={resolve(`/debts/${debt.id}`)}
				class="absolute inset-0 z-0 rounded-[inherit]"
				aria-label="View {debt.name}"
			></a>
			<Card.Header class="flex flex-row items-start justify-between gap-3">
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div
						class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
					>
						<Icon class="size-5" />
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<Card.Title class="truncate">{debt.name}</Card.Title>
							{#if debt.status === 'in_arrears'}
								<span
									class="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium tracking-wider text-rose-500 uppercase"
								>
									Past due
								</span>
							{/if}
							{#if isTopPriority}
								<span
									class="bg-primary/15 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase"
								>
									Pay first
								</span>
							{/if}
						</div>
						<Card.Description>
							{typeLabels[debt.type]}{#if debt.lender}
								· {debt.lender}{/if}
						</Card.Description>
					</div>
				</div>
				<div class="relative z-10">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Button {...props} variant="ghost" size="icon" class="size-11 shrink-0 md:size-8">
									<MoreHorizontal class="size-4" />
								</Button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end">
							<DropdownMenu.Item onclick={() => openEdit(debt)}>
								<Pencil class="mr-2 size-4" /> Edit
							</DropdownMenu.Item>
							<form
								method="POST"
								action="?/markPaidOff"
								use:enhance={() =>
									async ({ result }) => {
										if (result.type === 'success') {
											await invalidateAll();
											notify.success('Marked paid off');
										} else if (result.type === 'failure') {
											notify.error('Could not mark paid off');
										}
									}}
							>
								<input type="hidden" name="id" value={debt.id} />
								<DropdownMenu.Item>
									{#snippet child({ props })}
										<button
											{...props}
											type="submit"
											class="hover:bg-accent/50 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
										>
											<CheckCircle2 class="size-4" /> Mark paid off
										</button>
									{/snippet}
								</DropdownMenu.Item>
							</form>
							<form
								method="POST"
								action="?/delete"
								use:enhance={() =>
									async ({ result }) => {
										if (result.type === 'success') {
											await invalidateAll();
											notify.success('Debt deleted');
										} else if (result.type === 'failure') {
											notify.error('Could not delete');
										}
									}}
							>
								<input type="hidden" name="id" value={debt.id} />
								<DropdownMenu.Item>
									{#snippet child({ props })}
										<button
											{...props}
											type="submit"
											class="text-destructive hover:bg-accent/50 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
										>
											<Trash2 class="size-4" /> Delete
										</button>
									{/snippet}
								</DropdownMenu.Item>
							</form>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</Card.Header>
			<Card.Content class="relative z-10">
				<div class="mb-2 flex items-baseline justify-between text-sm tabular-nums">
					<span class="font-medium">{formatCents(debt.currentBalanceCents)}</span>
					<span class="text-muted-foreground">of {formatCents(debt.principalCents)}</span>
				</div>
				<div class="bg-muted relative h-2 overflow-hidden rounded-full">
					<div
						class="h-full transition-all {aprHigh ? 'bg-amber-500' : 'bg-emerald-500'}"
						style="width: {paid}%"
					></div>
				</div>
				<p class="text-muted-foreground mt-2 text-xs">
					{paid}% paid · APR {formatApr(debt.interestRatePct)}
					{#if debt.dueDay}
						· Due day {debt.dueDay}{/if}
					{#if debt.minimumPaymentCents > 0}
						· Min {formatCents(debt.minimumPaymentCents)}{/if}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="mt-3 w-full"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						openAddTransaction({
							defaultKind: directionTab === 'lent' ? 'income' : 'expense',
							debtTarget: {
								id: debt.id,
								name: debt.name,
								minimumPaymentCents: debt.minimumPaymentCents
							}
						});
					}}
				>
					{directionTab === 'lent' ? 'Collect' : 'Pay'}
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="md:col-span-2">
			<EmptyState
				icon={CreditCard}
				title="No debts tracked"
				description="Add credit cards, loans, BNPL, or any money you owe."
			>
				<Button onclick={() => (createOpen = true)}>Add debt</Button>
			</EmptyState>
		</div>
	{/each}
</div>

{#if paidOffDebts.length > 0}
	<div class="mt-8">
		<button
			type="button"
			class="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-sm font-medium"
			onclick={() => (showPaidOff = !showPaidOff)}
		>
			<span>Paid off · {paidOffDebts.length}</span>
			{#if showPaidOff}<ChevronUp class="size-4" />{:else}<ChevronDown class="size-4" />{/if}
		</button>
		{#if showPaidOff}
			<div class="mt-3 grid gap-4 md:grid-cols-2">
				{#each paidOffDebts as debt (debt.id)}
					<Card.Root class="opacity-60">
						<Card.Header class="flex flex-row items-center gap-3">
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"
							>
								<CheckCircle2 class="size-4" />
							</div>
							<div class="min-w-0">
								<Card.Title class="truncate text-sm">{debt.name}</Card.Title>
								<Card.Description class="text-xs">
									Paid off · {typeLabels[debt.type]}
								</Card.Description>
							</div>
						</Card.Header>
					</Card.Root>
				{/each}
			</div>
		{/if}
	</div>
{/if}

{#snippet createForm()}
	<DebtForm
		mode="create"
		initial={null}
		accounts={debtFormAccounts}
		onClose={() => (createOpen = false)}
	/>
{/snippet}

{#snippet editForm()}
	{#if editTarget}
		{#key editTarget.id}
			<DebtForm
				mode="edit"
				initial={editTarget}
				accounts={debtFormAccounts}
				onClose={() => (editOpen = false)}
			/>
		{/key}
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Add debt</Dialog.Title></Dialog.Header>
			{@render createForm()}
		</Dialog.Content>
	</Dialog.Root>
	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit debt</Dialog.Title></Dialog.Header>
			{@render editForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={createOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Add debt</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render createForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
	<Sheet.Root bind:open={editOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Edit debt</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render editForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
