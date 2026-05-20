<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, CreditCard, Wallet, Car, Home, Tag, Calendar } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { paidPercent, formatApr, nextDueDate, payoffProjection, parseAprToInt } from '$lib/utils/debt';
	import EmptyState from '$lib/components/empty-state.svelte';
	import { openAddTransaction } from '$lib/stores/add-transaction.svelte.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MoneyInput from '$lib/components/forms/money-input.svelte';

	let { data } = $props();

	const debtId = $derived(page.params.id);
	const debt = $derived(data.debts.find((d) => d.id === debtId));

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

	const paid = $derived(debt ? paidPercent(debt.principalCents, debt.currentBalanceCents) : 0);
	const nextDue = $derived(debt && debt.dueDay ? nextDueDate(debt.dueDay, Date.now()) : null);
	const projection = $derived(
		debt
			? payoffProjection(
					debt.currentBalanceCents,
					debt.minimumPaymentCents,
					debt.interestRatePct,
					Date.now()
				)
			: null
	);

	// Refinance simulator state
	let refiAprDisplay = $state('');
	let refiPaymentCents = $state<number | null>(null);
	const refiAprIntPct = $derived(parseAprToInt(refiAprDisplay) ?? 0);
	const refiProjection = $derived(
		debt && refiPaymentCents && refiPaymentCents > 0
			? payoffProjection(debt.currentBalanceCents, refiPaymentCents, refiAprIntPct, Date.now())
			: null
	);
	const refiSavingsCents = $derived(
		projection && refiProjection
			? projection.totalInterestCents - refiProjection.totalInterestCents
			: 0
	);

	const currency = $derived(data.accounts[0]?.currency ?? 'IDR');

	const payments = $derived(
		debt
			? data.transactions
					.filter((t) => (t as { debtId?: string | null }).debtId === debt.id)
					.sort((a, b) => b.occurredAt - a.occurredAt)
			: []
	);

	const accountById = $derived(new Map(data.allAccounts.map((a) => [a.id, a])));
</script>

<svelte:head><title>{debt?.name ?? 'Debt'} — Mavlo</title></svelte:head>

<div class="mb-6">
	<Button variant="ghost" size="sm" class="-ml-2 mb-3" href="/debts">
		<ArrowLeft class="mr-1 size-4" /> Debts
	</Button>

	{#if debt}
		{@const Icon = typeIcons[debt.type] ?? Wallet}
		<div class="mavlo-pill relative overflow-hidden rounded-2xl p-5">
			<div class="relative z-10 flex items-start gap-3">
				<div
					class="flex size-12 items-center justify-center rounded-xl border bg-primary/10 text-primary"
				>
					<Icon class="size-6" />
				</div>
				<div class="min-w-0 flex-1">
					<div class="text-muted-foreground text-xs tracking-wider uppercase">
						{typeLabels[debt.type]}{#if debt.lender} · {debt.lender}{/if}
					</div>
					<div class="text-xl leading-tight font-semibold">{debt.name}</div>
					<div class="text-muted-foreground mt-1 text-xs">APR {formatApr(debt.interestRatePct)}</div>
				</div>
			</div>
		</div>
	{/if}
</div>

{#if debt}
	<div class="mb-6 rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4">
		<div class="mb-3 flex items-baseline justify-between">
			<span class="text-sm font-semibold">Balance</span>
			<span class="text-sm font-semibold tabular-nums">{paid}% paid</span>
		</div>
		<div class="bg-muted relative mb-3 h-2.5 overflow-hidden rounded-full">
			<div
				class="h-full rounded-full bg-emerald-500 transition-all"
				style="width: {paid}%"
			></div>
		</div>
		<div class="grid grid-cols-3 gap-3 text-xs">
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">Current</div>
				<div class="mt-1 font-semibold tabular-nums">
					{formatCentsAsCurrency(debt.currentBalanceCents, currency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">Original</div>
				<div class="mt-1 font-semibold tabular-nums">
					{formatCentsAsCurrency(debt.principalCents, currency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">Min payment</div>
				<div class="mt-1 font-semibold tabular-nums">
					{formatCentsAsCurrency(debt.minimumPaymentCents, currency)}
				</div>
			</div>
		</div>
		{#if nextDue}
			<div class="text-muted-foreground mt-3 flex items-center gap-1 text-xs">
				<Calendar class="size-3" />
				Next due: {new Date(nextDue).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				})}
			</div>
		{/if}
	</div>

	<Button
		class="mb-6 w-full"
		onclick={() =>
			openAddTransaction({
				defaultKind: 'expense',
				debtTarget: {
					id: debt.id,
					name: debt.name,
					minimumPaymentCents: debt.minimumPaymentCents
				}
			})}
	>
		Record payment
	</Button>

	{#if projection}
		<div class="mb-6 rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-4">
			<div class="mb-2 text-sm font-semibold">Payoff projection</div>
			<div class="text-muted-foreground mb-3 text-xs">
				Paying {formatCentsAsCurrency(debt.minimumPaymentCents, currency)}/month at {formatApr(
					debt.interestRatePct
				)} APR
			</div>
			<div class="grid grid-cols-3 gap-3 text-xs">
				<div>
					<div class="text-muted-foreground uppercase tracking-wider">Months</div>
					<div class="mt-1 font-semibold tabular-nums">{projection.months}</div>
				</div>
				<div>
					<div class="text-muted-foreground uppercase tracking-wider">Total interest</div>
					<div class="mt-1 font-semibold tabular-nums">
						{formatCentsAsCurrency(projection.totalInterestCents, currency)}
					</div>
				</div>
				<div>
					<div class="text-muted-foreground uppercase tracking-wider">Debt-free by</div>
					<div class="mt-1 font-semibold tabular-nums">
						{new Date(projection.freeAtMs).toLocaleDateString('en-US', {
							month: 'short',
							year: 'numeric'
						})}
					</div>
				</div>
			</div>
		</div>
	{:else if debt.minimumPaymentCents > 0 && debt.currentBalanceCents > 0}
		<div class="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs text-rose-500">
			⚠ Minimum payment too low — barely covers interest. Debt will grow.
			Increase payment to make progress.
		</div>
	{/if}

	{#if debt.currentBalanceCents > 0}
		<details class="mb-6 rounded-xl border bg-card p-4">
			<summary class="cursor-pointer text-sm font-semibold">Refinance simulator</summary>
			<div class="text-muted-foreground mt-2 mb-3 text-xs">
				Compare savings if you refinance to a different APR or payment.
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="refi-apr">New APR %</Label>
					<Input
						id="refi-apr"
						type="text"
						inputmode="decimal"
						pattern="[0-9.]*"
						bind:value={refiAprDisplay}
						placeholder="12.0"
					/>
				</div>
				<div class="space-y-1">
					<Label for="refi-pay">New monthly payment</Label>
					<MoneyInput
						id="refi-pay"
						name="refiPay"
						min={1}
						bind:value={refiPaymentCents}
						class="h-12 text-lg md:h-12 md:text-lg"
					/>
				</div>
			</div>
			{#if refiProjection}
				<div class="mt-3 grid grid-cols-3 gap-3 text-xs">
					<div>
						<div class="text-muted-foreground uppercase tracking-wider">Months</div>
						<div class="mt-1 font-semibold tabular-nums">{refiProjection.months}</div>
					</div>
					<div>
						<div class="text-muted-foreground uppercase tracking-wider">Total interest</div>
						<div class="mt-1 font-semibold tabular-nums">
							{formatCentsAsCurrency(refiProjection.totalInterestCents, currency)}
						</div>
					</div>
					<div>
						<div class="text-muted-foreground uppercase tracking-wider">Savings</div>
						<div class="mt-1 font-semibold tabular-nums {refiSavingsCents > 0 ? 'text-emerald-500' : refiSavingsCents < 0 ? 'text-expense' : ''}">
							{refiSavingsCents > 0 ? '+' : ''}{formatCentsAsCurrency(refiSavingsCents, currency)}
						</div>
					</div>
				</div>
			{:else if refiPaymentCents && refiPaymentCents > 0}
				<p class="mt-3 text-xs text-rose-500">
					Payment too low to cover interest at this APR — debt would grow.
				</p>
			{/if}
		</details>
	{/if}

	<div class="mb-3 text-sm font-semibold">Payment history</div>

	<div class="space-y-2">
		{#each payments as tx (tx.id)}
			{@const acc = accountById.get(tx.accountId)}
			<div class="bg-card flex items-center justify-between rounded-lg border p-3">
				<div class="min-w-0">
					<div class="text-sm font-medium">
						{new Date(tx.occurredAt).toLocaleDateString('en-US', {
							weekday: 'short',
							month: 'short',
							day: 'numeric'
						})}
					</div>
					<div class="text-muted-foreground text-xs">
						{acc?.name ?? '—'}{#if tx.note} · {tx.note}{/if}
					</div>
				</div>
				<span class="text-expense text-sm font-semibold tabular-nums">
					−{formatCentsAsCurrency(tx.amountCents, acc?.currency ?? currency)}
				</span>
			</div>
		{:else}
			<EmptyState
				icon={CreditCard}
				title="No payments yet"
				description="Record a payment from your transactions."
			/>
		{/each}
	</div>
{:else}
	<p class="text-muted-foreground text-sm">Debt not found.</p>
{/if}
