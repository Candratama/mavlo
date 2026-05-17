<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft, CreditCard, Wallet, Car, Home, Tag, Calendar } from 'lucide-svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { paidPercent, formatApr, nextDueDate } from '$lib/utils/debt';
	import EmptyState from '$lib/components/empty-state.svelte';

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
