<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight } from 'lucide-svelte';

	let { data } = $props();

	const formatCents = (cents: number, currency: string) =>
		new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency,
			minimumFractionDigits: 0
		}).format(cents / 100);

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
</script>

<svelte:head><title>Dashboard — Mavlo</title></svelte:head>

<h1 class="text-2xl font-semibold">Dashboard</h1>
<p class="mt-2 text-sm text-muted-foreground">
	Welcome, {data.user.name}. Currency: {data.preferences.currency} · Locale: {data.preferences.locale}
</p>

<div class="mt-8 grid gap-4 md:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<Card.Description>Net worth</Card.Description>
			<Card.Title class="text-2xl tabular-nums">
				{formatCents(data.netWorthCents, data.displayCurrency)}
			</Card.Title>
		</Card.Header>
		<Card.Content class="text-xs text-muted-foreground">
			Sum of all account balances.
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Description>This month spending</Card.Description>
			<Card.Title class="text-2xl tabular-nums text-rose-600 dark:text-rose-400">
				{formatCents(data.monthExpenseCents, data.displayCurrency)}
			</Card.Title>
		</Card.Header>
		<Card.Content class="text-xs text-muted-foreground">
			Income:
			<span class="text-emerald-600 dark:text-emerald-400">
				{formatCents(data.monthIncomeCents, data.displayCurrency)}
			</span>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Description>Recent activity</Card.Description>
			<Card.Title class="text-2xl">{data.recent.length}</Card.Title>
		</Card.Header>
		<Card.Content class="text-xs text-muted-foreground">
			Last {data.recent.length} transaction{data.recent.length === 1 ? '' : 's'}.
		</Card.Content>
	</Card.Root>
</div>

<Card.Root class="mt-8">
	<Card.Header class="flex flex-row items-center justify-between">
		<Card.Title>Recent transactions</Card.Title>
		<Button variant="ghost" size="sm" href="/transactions">
			View all <ArrowRight class="size-4 ml-1" />
		</Button>
	</Card.Header>
	<Card.Content class="p-0">
		{#if data.recent.length === 0}
			<p class="text-sm text-muted-foreground p-6 text-center">
				No transactions yet. <a href="/transactions" class="underline">Add one</a>.
			</p>
		{:else}
			<ul class="divide-y">
				{#each data.recent as r}
					<li class="px-6 py-3 flex items-center justify-between text-sm">
						<div class="flex flex-col">
							<span class="font-medium">
								{r.note || r.categoryName || r.accountName || 'Transaction'}
							</span>
							<span class="text-xs text-muted-foreground">
								{formatDate(r.occurredAt)} · {r.accountName ?? '—'}
								{#if r.categoryName} · {r.categoryName}{/if}
							</span>
						</div>
						<span
							class={r.kind === 'income'
								? 'text-emerald-600 dark:text-emerald-400 tabular-nums'
								: 'text-rose-600 dark:text-rose-400 tabular-nums'}
						>
							{r.kind === 'expense' ? '−' : '+'}{formatCents(r.amountCents, r.accountCurrency)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
