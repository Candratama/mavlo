<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight, ArrowLeftRight, TrendingUp, TrendingDown, Tag } from 'lucide-svelte';
	import SpendingByCategoryChart from '$lib/components/charts/SpendingByCategoryChart.svelte';
	import DailySpendingChart from '$lib/components/charts/DailySpendingChart.svelte';
	import IncomeExpenseChart from '$lib/components/charts/IncomeExpenseChart.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { formatCycleLabel } from '$lib/utils/cycle.js';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import { setupPullToRefresh } from '$lib/actions/pull-to-refresh.js';
	import { openAddTransaction } from '$lib/stores/add-transaction.svelte.js';

	let { data } = $props();

	const cycleLabel = $derived.by(() => {
		if (!data.cycle) return null;
		return formatCycleLabel(
			{
				start: new Date(data.cycle.startMs),
				end: new Date(data.cycle.endMs),
				periodMonth: data.cycle.periodMonth
			},
			data.monthStartDay,
			data.preferences.locale
		);
	});

	const cycleProgress = $derived.by(() => {
		if (!data.cycle) return 0;
		const total = data.cycle.endMs - data.cycle.startMs;
		const elapsed = Date.now() - data.cycle.startMs;
		return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
	});

	const cycleNetCents = $derived(data.monthIncomeCents - data.monthExpenseCents);
	const trendingUp = $derived(cycleNetCents >= 0);

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	let chartTab = $state<'category' | 'daily' | 'trend'>('category');
	const chartTabOptions = [
		{ value: 'category', label: 'Category' },
		{ value: 'daily', label: 'Daily' },
		{ value: 'trend', label: 'Trend' }
	];

	$effect(() => {
		if (typeof window === 'undefined') return;
		return setupPullToRefresh(document.body, { threshold: 80 });
	});

	const firstName = $derived(data.user.name?.split(' ')[0] ?? data.user.name ?? '');
</script>

<svelte:head><title>Dashboard — Mavlo</title></svelte:head>

<!-- Greeting -->
<p class="text-xs uppercase tracking-wider text-muted-foreground mb-1">Hi, {firstName}</p>

<!-- Hero net worth -->
<div class="relative overflow-hidden rounded-2xl border bg-gradient-to-br {trendingUp ? 'from-emerald-500/10' : 'from-rose-500/10'} via-background to-background p-5 sm:p-6">
	<div class="flex items-baseline justify-between">
		<span class="text-xs uppercase tracking-wider text-muted-foreground">Net worth</span>
		<span class="inline-flex items-center gap-1 text-xs {trendingUp ? 'text-income' : 'text-expense'}">
			{#if trendingUp}<TrendingUp class="size-3" />{:else}<TrendingDown class="size-3" />{/if}
			{trendingUp ? '+' : ''}{formatCentsAsCurrency(cycleNetCents, data.displayCurrency)}
		</span>
	</div>
	<p class="mt-1 text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight">
		{formatCentsAsCurrency(data.netWorthCents, data.displayCurrency)}
	</p>
	{#if cycleLabel}
		<p class="mt-2 text-xs text-muted-foreground">{cycleLabel}</p>
		<div class="mt-3 h-1 rounded-full bg-muted overflow-hidden">
			<div class="h-full bg-primary transition-all" style="width: {cycleProgress}%"></div>
		</div>
		<p class="mt-1 text-[10px] text-muted-foreground">{cycleProgress}% through cycle</p>
	{/if}
</div>


<!-- Cycle dual-stat -->
<div class="mt-4 grid grid-cols-2 gap-3">
	<div class="rounded-xl border bg-card p-4">
		<p class="text-xs uppercase tracking-wider text-muted-foreground">Income</p>
		<p class="mt-1 text-lg sm:text-xl font-semibold tabular-nums text-income">
			+{formatCentsAsCurrency(data.monthIncomeCents, data.displayCurrency)}
		</p>
	</div>
	<div class="rounded-xl border bg-card p-4">
		<p class="text-xs uppercase tracking-wider text-muted-foreground">Expense</p>
		<p class="mt-1 text-lg sm:text-xl font-semibold tabular-nums text-expense">
			−{formatCentsAsCurrency(data.monthExpenseCents, data.displayCurrency)}
		</p>
	</div>
</div>

<!-- Charts: tab on mobile, grid on desktop -->
<div class="mt-6">
	<div class="md:hidden">
		<SegmentedControl options={chartTabOptions} bind:value={chartTab} ariaLabel="Chart" />
		<Card.Root class="mt-3">
			<Card.Header class="pb-2">
				<Card.Title class="text-base">
					{chartTab === 'category' ? 'Spending by category' : chartTab === 'daily' ? 'Daily spending' : 'Income vs expense'}
				</Card.Title>
				<Card.Description>
					{chartTab === 'trend' ? 'Last 6 months' : 'This cycle'}
				</Card.Description>
			</Card.Header>
			<Card.Content class="p-3 pt-0">
				{#if chartTab === 'category'}
					<SpendingByCategoryChart data={data.spendingByCategory} currency={data.displayCurrency} />
				{:else if chartTab === 'daily'}
					<DailySpendingChart data={data.dailySpending} currency={data.displayCurrency} />
				{:else}
					<IncomeExpenseChart data={data.monthlyIncomeExpense} currency={data.displayCurrency} />
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<div class="hidden md:grid gap-4 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Spending by category</Card.Title>
				<Card.Description>This cycle</Card.Description>
			</Card.Header>
			<Card.Content>
				<SpendingByCategoryChart data={data.spendingByCategory} currency={data.displayCurrency} />
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Daily spending</Card.Title>
				<Card.Description>This cycle</Card.Description>
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
</div>

<!-- Recent transactions -->
<Card.Root class="mt-6">
	<Card.Header class="flex flex-row items-center justify-between pb-2">
		<Card.Title class="text-base">Recent</Card.Title>
		<Button variant="ghost" size="sm" href="/transactions">
			View all <ArrowRight class="size-4 ml-1" />
		</Button>
	</Card.Header>
	<Card.Content class="p-0">
		{#if data.recent.length === 0}
			<EmptyState icon={ArrowLeftRight} title="No transactions yet" description="Add a transaction to see it here.">
				<Button onclick={() => openAddTransaction('expense')}>Add transaction</Button>
			</EmptyState>
		{:else}
			<ul class="divide-y">
				{#each data.recent as r (r.id)}
					{@const IconComp = (r.kind === 'transfer' ? ArrowLeftRight : (getIconByName(r.categoryIcon) ?? Tag)) as any}
					{@const tint = r.categoryColor ?? (r.kind === 'income' ? '#10b981' : r.kind === 'transfer' ? '#3b82f6' : '#94a3b8')}
					<li class="px-4 sm:px-6 py-3 flex items-center gap-3">
						<div class="size-9 shrink-0 rounded-lg flex items-center justify-center" style="background-color: {tint}20; color: {tint}">
							<IconComp class="size-4" />
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium truncate">
								{r.note || r.categoryName || r.accountName || 'Transaction'}
							</p>
							<p class="text-xs text-muted-foreground truncate">
								{formatDate(r.occurredAt)} · {r.accountName ?? '—'}
							</p>
						</div>
						<span
							class="text-sm font-semibold tabular-nums whitespace-nowrap {r.kind === 'income'
								? 'text-income'
								: r.kind === 'transfer'
									? 'text-transfer'
									: 'text-expense'}"
						>
							{r.kind === 'expense' ? '−' : r.kind === 'income' ? '+' : ''}{formatCentsAsCurrency(r.amountCents, r.accountCurrency)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
