<script lang="ts" module>
	import type { Component } from 'svelte';

	// Module-scope cache so chart components survive across `/dashboard` re-mounts.
	// Dynamic import promises are also browser-cached, but assigning to module vars
	// avoids the brief `null → loaded` flash on every navigation.
	let cachedCategoryChart: Component | null = null;
	let cachedDailyChart: Component | null = null;
	let cachedTrendChart: Component | null = null;
	let chartLoadPromise: Promise<void> | null = null;

	function loadCharts(): Promise<void> {
		if (cachedCategoryChart && cachedDailyChart && cachedTrendChart) return Promise.resolve();
		if (chartLoadPromise) return chartLoadPromise;
		chartLoadPromise = Promise.all([
			import('$lib/components/charts/SpendingByCategoryChart.svelte'),
			import('$lib/components/charts/DailySpendingChart.svelte'),
			import('$lib/components/charts/IncomeExpenseChart.svelte')
		]).then(([s, d, i]) => {
			cachedCategoryChart = s.default as Component;
			cachedDailyChart = d.default as Component;
			cachedTrendChart = i.default as Component;
		});
		return chartLoadPromise;
	}
</script>

<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { ArrowRight, ArrowLeftRight, ArrowUp, ArrowDown, Tag, Eye, EyeOff } from 'lucide-svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { formatCycleLabel } from '$lib/utils/cycle.js';
	import { getIconByName, type IconComponent } from '$lib/utils/category-icons.js';
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

	const budgetPercent = $derived(
		data.budgetLimitCents > 0
			? Math.min(100, Math.round((data.budgetSpentCents / data.budgetLimitCents) * 100))
			: 0
	);
	const budgetOver = $derived(data.budgetSpentCents > data.budgetLimitCents);

	const HIDE_KEY = 'mavlo:hideBalance';
	let hideBalance = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		hideBalance = window.localStorage.getItem(HIDE_KEY) === '1';
	});

	function toggleHideBalance() {
		hideBalance = !hideBalance;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(HIDE_KEY, hideBalance ? '1' : '0');
		}
	}

	const maskedAmount = '••••••';

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	let chartTab = $state<'category' | 'daily' | 'trend'>('category');
	const chartTabOptions = [
		{ value: 'category', label: 'Category' },
		{ value: 'daily', label: 'Daily' },
		{ value: 'trend', label: 'Trend' }
	];

	let SpendingByCategoryChart = $state<Component | null>(cachedCategoryChart);
	let DailySpendingChart = $state<Component | null>(cachedDailyChart);
	let IncomeExpenseChart = $state<Component | null>(cachedTrendChart);

	onMount(() => {
		if (SpendingByCategoryChart && DailySpendingChart && IncomeExpenseChart) return;
		void loadCharts().then(() => {
			SpendingByCategoryChart = cachedCategoryChart;
			DailySpendingChart = cachedDailyChart;
			IncomeExpenseChart = cachedTrendChart;
		});
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		return setupPullToRefresh(document.body, { threshold: 80 });
	});

	const firstName = $derived(data.user.name?.split(' ')[0] ?? data.user.name ?? '');
	const greetingName = $derived(data.user.username ?? firstName);
</script>

<svelte:head><title>Dashboard — Mavlo</title></svelte:head>

<!-- Greeting -->
<h2 class="mavlo-headline mb-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-xl">
	~ Hi, {greetingName}
</h2>

<!-- Hero total balance -->
<div
	class="relative overflow-hidden rounded-2xl border bg-gradient-to-br {trendingUp
		? 'from-emerald-500/15'
		: 'from-rose-500/15'} via-background to-background p-5 text-center sm:p-6"
>
	<button
		type="button"
		onclick={toggleHideBalance}
		aria-label={hideBalance ? 'Show balance' : 'Hide balance'}
		class="text-muted-foreground hover:bg-accent/40 absolute top-3 right-3 inline-flex size-9 cursor-pointer items-center justify-center rounded-full"
	>
		{#if hideBalance}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
	</button>
	<p class="text-muted-foreground text-xs tracking-wider uppercase">
		Total Balance <span class="text-foreground/70">({data.displayCurrency})</span>
	</p>
	<p class="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
		{hideBalance ? maskedAmount : formatCentsAsCurrency(data.netWorthCents, data.displayCurrency)}
	</p>
	{#if cycleLabel}
		<div class="bg-muted mt-4 h-1 overflow-hidden rounded-full">
			<div class="bg-primary h-full transition-all" style="width: {cycleProgress}%"></div>
		</div>
		<p class="text-muted-foreground mt-2 text-[10px]">
			{cycleLabel} · {cycleProgress}% through cycle
		</p>
	{/if}
</div>

<!-- Cycle dual-stat -->
<div class="mt-4 grid grid-cols-2 gap-3">
	<div class="via-card to-card rounded-xl border bg-gradient-to-br from-emerald-500/10 p-4">
		<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
			<span class="bg-income/15 inline-flex size-6 items-center justify-center rounded-full">
				<ArrowDown class="text-income size-3.5" />
			</span>
			Income
		</div>
		<p class="mt-2 text-lg font-semibold tabular-nums sm:text-xl">
			{hideBalance
				? maskedAmount
				: formatCentsAsCurrency(data.monthIncomeCents, data.displayCurrency)}
		</p>
	</div>
	<div class="via-card to-card rounded-xl border bg-gradient-to-br from-rose-500/10 p-4">
		<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
			<span class="bg-expense/15 inline-flex size-6 items-center justify-center rounded-full">
				<ArrowUp class="text-expense size-3.5" />
			</span>
			Expense
		</div>
		<p class="mt-2 text-lg font-semibold tabular-nums sm:text-xl">
			{hideBalance
				? maskedAmount
				: formatCentsAsCurrency(data.monthExpenseCents, data.displayCurrency)}
		</p>
	</div>
</div>

{#if data.budgetLimitCents > 0}
	<a
		href={resolve('/budgets')}
		class="mt-4 block rounded-xl border bg-gradient-to-br {budgetOver
			? 'from-rose-500/10'
			: 'from-primary/10'} via-card to-card hover:bg-accent/20 p-4 transition-colors"
	>
		<div class="mb-2 flex items-center justify-between">
			<span class="text-sm font-semibold">Monthly Budget</span>
			<span
				class="text-sm font-semibold tabular-nums {budgetOver
					? 'text-expense'
					: 'text-muted-foreground'}"
			>
				{budgetPercent}%
			</span>
		</div>
		<div class="bg-muted mb-2 h-2 overflow-hidden rounded-full">
			<div
				class="h-full transition-all {budgetOver ? 'bg-expense' : 'bg-primary'}"
				style="width: {budgetPercent}%"
			></div>
		</div>
		<div class="text-muted-foreground flex justify-between text-xs tabular-nums">
			<span
				>{hideBalance
					? maskedAmount
					: formatCentsAsCurrency(data.budgetSpentCents, data.displayCurrency)}</span
			>
			<span
				>{hideBalance
					? maskedAmount
					: formatCentsAsCurrency(data.budgetLimitCents, data.displayCurrency)}</span
			>
		</div>
		{#if data.subsidies.length > 0}
			{@const totalSubsidy = data.subsidies.reduce((s, x) => s + x.amountCents, 0)}
			<div class="text-muted-foreground mt-2 text-xs">
				{data.subsidies.length} active {data.subsidies.length === 1 ? 'subsidy' : 'subsidies'} ·
				{hideBalance ? maskedAmount : formatCentsAsCurrency(totalSubsidy, data.displayCurrency)}
				redistributed
			</div>
		{/if}
	</a>
{/if}

{#if data.unbudgetedCategories.length > 0}
	{@const totalUnbudgeted = data.unbudgetedCategories.reduce((s, c) => s + c.spentCents, 0)}
	<a
		href={resolve('/budgets')}
		class="mt-3 block rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10"
	>
		<div class="text-xs font-medium text-amber-600 dark:text-amber-400">
			⚠ Unbudgeted spending detected
		</div>
		<div class="text-muted-foreground mt-1 text-xs">
			{data.unbudgetedCategories.length} {data.unbudgetedCategories.length === 1 ? 'category' : 'categories'} ·
			{hideBalance ? maskedAmount : formatCentsAsCurrency(totalUnbudgeted, data.displayCurrency)} untracked.
			Tap to assign budgets.
		</div>
	</a>
{/if}

<!-- Charts: tab on mobile, grid on desktop -->
<div class="mt-6">
	<div class="md:hidden">
		<SegmentedControl options={chartTabOptions} bind:value={chartTab} ariaLabel="Chart" />
		<Card.Root class="mt-3">
			<Card.Header class="pb-2">
				<Card.Title class="text-base">
					{chartTab === 'category'
						? 'Spending by category'
						: chartTab === 'daily'
							? 'Daily spending'
							: 'Income vs expense'}
				</Card.Title>
				<Card.Description>
					{chartTab === 'trend' ? 'Last 6 months' : 'This cycle'}
				</Card.Description>
			</Card.Header>
			<Card.Content class="p-3 pt-0">
				{#if chartTab === 'category' && SpendingByCategoryChart}
					<SpendingByCategoryChart data={data.spendingByCategory} currency={data.displayCurrency} />
				{:else if chartTab === 'daily' && DailySpendingChart}
					<DailySpendingChart data={data.dailySpending} currency={data.displayCurrency} />
				{:else if IncomeExpenseChart}
					<IncomeExpenseChart data={data.monthlyIncomeExpense} currency={data.displayCurrency} />
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<div class="hidden gap-4 md:grid lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Spending by category</Card.Title>
				<Card.Description>This cycle</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if SpendingByCategoryChart}
					<SpendingByCategoryChart data={data.spendingByCategory} currency={data.displayCurrency} />
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Daily spending</Card.Title>
				<Card.Description>This cycle</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if DailySpendingChart}
					<DailySpendingChart data={data.dailySpending} currency={data.displayCurrency} />
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="lg:col-span-2">
			<Card.Header>
				<Card.Title>Income vs expense</Card.Title>
				<Card.Description>Last 6 months</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if IncomeExpenseChart}
					<IncomeExpenseChart data={data.monthlyIncomeExpense} currency={data.displayCurrency} />
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Recent transactions -->
<Card.Root class="mt-6">
	<Card.Header class="flex flex-row items-center justify-between pb-2">
		<Card.Title class="text-base">Recent</Card.Title>
		<Button variant="ghost" size="sm" href="/transactions">
			View all <ArrowRight class="ml-1 size-4" />
		</Button>
	</Card.Header>
	<Card.Content class="p-0">
		{#if data.recent.length === 0}
			<EmptyState
				icon={ArrowLeftRight}
				title="No transactions yet"
				description="Add a transaction to see it here."
			>
				<Button onclick={() => openAddTransaction('expense')}>Add transaction</Button>
			</EmptyState>
		{:else}
			<ul class="divide-y">
				{#each data.recent as r (r.id)}
					{@const IconComp = (
						r.kind === 'transfer' ? ArrowLeftRight : (getIconByName(r.categoryIcon) ?? Tag)
					) as IconComponent}
					{@const tint =
						r.categoryColor ??
						(r.kind === 'income' ? '#10b981' : r.kind === 'transfer' ? '#3b82f6' : '#94a3b8')}
					<li class="flex items-center gap-3 px-4 py-3 sm:px-6">
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-lg"
							style="background-color: {tint}20; color: {tint}"
						>
							<IconComp class="size-4" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">
								{r.note || r.categoryName || r.accountName || 'Transaction'}
							</p>
							<p class="text-muted-foreground truncate text-xs">
								{formatDate(r.occurredAt)} · {r.accountName ?? '—'}
							</p>
						</div>
						<span
							class="text-sm font-semibold whitespace-nowrap tabular-nums {r.kind === 'income'
								? 'text-income'
								: r.kind === 'transfer'
									? 'text-transfer'
									: 'text-expense'}"
						>
							{r.kind === 'expense' ? '−' : r.kind === 'income' ? '+' : ''}{formatCentsAsCurrency(
								r.amountCents,
								r.accountCurrency
							)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
