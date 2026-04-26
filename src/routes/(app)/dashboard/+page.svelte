<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight, ArrowLeftRight } from 'lucide-svelte';
	import SpendingByCategoryChart from '$lib/components/charts/SpendingByCategoryChart.svelte';
	import DailySpendingChart from '$lib/components/charts/DailySpendingChart.svelte';
	import IncomeExpenseChart from '$lib/components/charts/IncomeExpenseChart.svelte';

	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import EmptyState from '$lib/components/empty-state.svelte';

	let { data } = $props();

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
				{formatCentsAsCurrency(data.netWorthCents, data.displayCurrency)}
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
				{formatCentsAsCurrency(data.monthExpenseCents, data.displayCurrency)}
			</Card.Title>
		</Card.Header>
		<Card.Content class="text-xs text-muted-foreground">
			Income:
			<span class="text-emerald-600 dark:text-emerald-400">
				{formatCentsAsCurrency(data.monthIncomeCents, data.displayCurrency)}
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

<div class="mt-8 grid gap-4 lg:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>Spending by category</Card.Title>
			<Card.Description>This month</Card.Description>
		</Card.Header>
		<Card.Content>
			<SpendingByCategoryChart data={data.spendingByCategory} currency={data.displayCurrency} />
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Daily spending</Card.Title>
			<Card.Description>This month</Card.Description>
		</Card.Header>
		<Card.Content>
			<DailySpendingChart data={data.dailySpending} currency={data.displayCurrency} />
		</Card.Content>
	</Card.Root>

	<Card.Root class="lg:col-span-2">
		<Card.Header>
			<Card.Title>Income vs expense</Card.Title>
			<Card.Description>Last 6 months</Card.Description>
		</Card.Header>
		<Card.Content>
			<IncomeExpenseChart data={data.monthlyIncomeExpense} currency={data.displayCurrency} />
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
			<EmptyState icon={ArrowLeftRight} title="No transactions yet" description="Add a transaction to see it here.">
				<Button href="/transactions">Add transaction</Button>
			</EmptyState>
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
							{r.kind === 'expense' ? '−' : '+'}{formatCentsAsCurrency(r.amountCents, r.accountCurrency)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
