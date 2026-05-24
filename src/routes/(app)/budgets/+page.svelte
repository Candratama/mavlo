<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import MoneyInput from '$lib/components/forms/money-input.svelte';
	import SubmitButton from '$lib/components/forms/submit-button.svelte';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import PickerSheet, { type PickerItem } from '$lib/components/ui/picker-sheet.svelte';
	import {
		Plus,
		MoreHorizontal,
		Pencil,
		Trash2,
		Target,
		Tag,
		PiggyBank,
		Wallet,
		AlertTriangle,
		CheckCircle2
	} from 'lucide-svelte';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { effectiveLimit, sourceRemaining } from '$lib/utils/budget.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import SubsidyCreateForm from '$lib/components/budgets/subsidy-create-form.svelte';
	import SubsidyList from '$lib/components/budgets/subsidy-list.svelte';
	import SubsidyEditForm from '$lib/components/budgets/subsidy-edit-form.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { data } = $props();

	const isDesktop = new MediaQuery('(min-width: 768px)');

	type BudgetRow = (typeof data.budgets)[number];

	let createOpen = $state(false);
	let editOpen = $state(false);
	let editTarget = $state<BudgetRow | null>(null);
	let createPending = $state(false);
	let editPending = $state(false);

	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const flowOf = (budgetId: string) =>
		data.subsidyFlowByBudget[budgetId] ?? { in: 0, out: 0 };

	const formatCents = (cents: number) => formatCentsAsCurrency(cents, 'IDR');

	const openEdit = (b: BudgetRow) => {
		editTarget = b;
		editOpen = true;
	};

	const remainingFor = (b: typeof data.budgets[0]) => {
		const flow = flowOf(b.id);
		const carryover = b.carryoverDeficitCents ?? 0;
		return b.limitCents + flow.in - (data.spentByCategory[b.categoryId] ?? 0) - flow.out - carryover;
	};
	const sortedBudgets = $derived(
		[...data.budgets].sort((a, b) => remainingFor(b) - remainingFor(a))
	);
	const totalAllocated = $derived(data.budgets.reduce((s, b) => s + b.limitCents, 0));
	const totalSpent = $derived(
		data.budgets.reduce((s, b) => s + (data.spentByCategory[b.categoryId] ?? 0), 0)
	);

	const alloc = $derived(data.allocation);
	const overAllocated = $derived(alloc.unallocatedCents < 0);
	const fullyAllocated = $derived(alloc.unallocatedCents === 0 && alloc.totalCashCents > 0);

	const pct = (spent: number, limit: number) =>
		limit === 0 ? 0 : Math.min(100, Math.round((spent / limit) * 100));

	type Icon = PickerItem['icon'];
	const fallbackCategoryIcon = Tag as unknown as Icon;
	const expenseCategoryItems = $derived<PickerItem[]>(
		data.expenseCategories.map((c) => ({
			value: c.id,
			label: c.name,
			icon: (getIconByName(c.icon) as unknown as Icon) ?? fallbackCategoryIcon
		}))
	);

	let createCategoryId = $state('');
	let editCategoryId = $state('');

	// Debt budget suggestion: when active debts exist but no budget covers them.
	const debtPaymentCategory = $derived(
		data.categories.find((c) => c.name === 'Debt Payment' && c.kind === 'expense')
	);
	const activeDebts = $derived(data.debts.filter((d) => d.status === 'active'));
	const totalMinPayments = $derived(
		activeDebts.reduce((s, d) => s + d.minimumPaymentCents, 0)
	);
	const debtBudgetExists = $derived(
		debtPaymentCategory
			? data.budgets.some(
					(b) =>
						b.categoryId === debtPaymentCategory.id && b.periodMonth === data.periodMonth
				)
			: false
	);
	const showDebtBudgetSuggestion = $derived(
		activeDebts.length > 0 && totalMinPayments > 0 && !debtBudgetExists
	);

	let subsidyOpen = $state(false);
	let subsidyTarget = $state<BudgetRow | null>(null);

	const eligibleSourcesFor = (target: BudgetRow) => {
		return data.budgets
			.filter((b) => b.id !== target.id && b.periodMonth === target.periodMonth)
			.map((b) => {
				const spentB = data.spentByCategory[b.categoryId] ?? 0;
				const out = (data.subsidyFlowByBudget[b.id]?.out) ?? 0;
				const carryover = b.carryoverDeficitCents ?? 0;
				const remaining = sourceRemaining({
					limitCents: b.limitCents - carryover,
					spentCents: spentB,
					subsidyOutCents: out
				});
				const cat = categoryById.get(b.categoryId);
				return {
					budgetId: b.id,
					categoryName: cat?.name ?? 'Unknown',
					categoryIcon: cat?.icon ?? null,
					sourceRemainingCents: remaining
				};
			})
			.filter((s) => s.sourceRemainingCents > 0);
	};

	const openSubsidy = (b: BudgetRow) => {
		subsidyTarget = b;
		subsidyOpen = true;
	};

	type SubsidyRow = (typeof data.subsidies)[number];

	let subsidyEditOpen = $state(false);
	let subsidyEditTarget = $state<SubsidyRow | null>(null);

	const budgetById = $derived(new Map(data.budgets.map((b) => [b.id, b])));

	const subsidiesByBudget = $derived.by(() => {
		const inMap: Record<string, SubsidyRow[]> = {};
		const outMap: Record<string, SubsidyRow[]> = {};
		for (const s of data.subsidies) {
			(inMap[s.toBudgetId] ??= []).push(s);
			(outMap[s.fromBudgetId] ??= []).push(s);
		}
		return { inMap, outMap };
	});

	const entriesForBudget = (budgetId: string) => {
		const { inMap, outMap } = subsidiesByBudget;
		const entries: {
			id: string;
			direction: 'in' | 'out';
			counterpartName: string;
			amountCents: number;
			note: string | null;
		}[] = [];
		for (const s of inMap[budgetId] ?? []) {
			const fromBudget = budgetById.get(s.fromBudgetId);
			const cat = fromBudget ? categoryById.get(fromBudget.categoryId) : null;
			entries.push({
				id: s.id,
				direction: 'in',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		for (const s of outMap[budgetId] ?? []) {
			const toBudget = budgetById.get(s.toBudgetId);
			const cat = toBudget ? categoryById.get(toBudget.categoryId) : null;
			entries.push({
				id: s.id,
				direction: 'out',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		return entries;
	};

	const openSubsidyEdit = (subsidyId: string) => {
		subsidyEditTarget = data.subsidies.find((s) => s.id === subsidyId) ?? null;
		subsidyEditOpen = subsidyEditTarget !== null;
	};

	$effect(() => {
		if (createOpen && !createCategoryId) {
			createCategoryId = data.expenseCategories[0]?.id ?? '';
		}
	});

	$effect(() => {
		if (editTarget) editCategoryId = editTarget.categoryId;
	});
</script>

<svelte:head><title>Budgets — Mavlo</title></svelte:head>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="mavlo-headline text-2xl font-bold tracking-tight sm:text-3xl">Budgets</h1>
	</div>
	<Button class="lift" onclick={() => (createOpen = true)}>
		<Plus class="mr-1 size-4" /> New budget
	</Button>
</div>

<div
	class="mb-6 rounded-xl border bg-gradient-to-br {overAllocated
		? 'from-rose-500/10'
		: fullyAllocated
			? 'from-emerald-500/10'
			: 'from-amber-500/10'} via-card to-card p-4 sm:p-5"
>
	<div class="mb-3 flex items-start justify-between gap-3">
		<div>
			<div class="text-muted-foreground text-xs tracking-wider uppercase">
				{overAllocated ? 'Over-allocated' : fullyAllocated ? 'Fully allocated' : 'Unallocated'}
			</div>
			<div
				class="mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl {overAllocated
					? 'text-expense'
					: fullyAllocated
						? 'text-emerald-500'
						: ''}"
			>
				{formatCents(Math.abs(alloc.unallocatedCents))}
			</div>
		</div>
		<div
			class="flex size-10 shrink-0 items-center justify-center rounded-full {overAllocated
				? 'bg-rose-500/15 text-rose-500'
				: fullyAllocated
					? 'bg-emerald-500/15 text-emerald-500'
					: 'bg-amber-500/15 text-amber-500'}"
		>
			{#if overAllocated}
				<AlertTriangle class="size-5" />
			{:else if fullyAllocated}
				<CheckCircle2 class="size-5" />
			{:else}
				<Target class="size-5" />
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-3 gap-3 text-xs">
		<div>
			<div class="text-muted-foreground flex items-center gap-1 tracking-wider uppercase">
				<Wallet class="size-3" /> Balance
			</div>
			<div class="mt-1 font-semibold tabular-nums">{formatCents(alloc.totalCashCents)}</div>
		</div>
		<div>
			<div class="text-muted-foreground flex items-center gap-1 tracking-wider uppercase">
				<PiggyBank class="size-3" /> Savings
			</div>
			<div class="mt-1 font-semibold tabular-nums">{formatCents(alloc.savingsCents)}</div>
		</div>
		<div>
			<div class="text-muted-foreground flex items-center gap-1 tracking-wider uppercase">
				<Target class="size-3" /> Budget
			</div>
			<div class="mt-1 font-semibold tabular-nums">{formatCents(alloc.assignedCents)}</div>
		</div>
	</div>
</div>

<div
	class="mb-6 rounded-xl border bg-gradient-to-br {totalSpent > totalAllocated
		? 'from-rose-500/10'
		: 'from-primary/10'} via-card to-card p-4"
>
	<div class="mb-2 flex items-center justify-between">
		<span class="text-sm font-semibold">Spent vs Budget</span>
		<span
			class="text-sm font-semibold tabular-nums {totalSpent > totalAllocated
				? 'text-expense'
				: 'text-muted-foreground'}"
		>
			{pct(totalSpent, totalAllocated)}%
		</span>
	</div>
	<div class="bg-muted mb-2 h-2 overflow-hidden rounded-full">
		<div
			class="h-full transition-all {totalSpent > totalAllocated ? 'bg-expense' : 'bg-primary'}"
			style="width: {pct(totalSpent, totalAllocated)}%"
		></div>
	</div>
	<div class="text-muted-foreground flex justify-between text-xs tabular-nums">
		<span>{formatCents(totalSpent)}</span>
		<span>{formatCents(totalAllocated)}</span>
	</div>
	{#if data.subsidies.length > 0}
		{@const totalSubsidy = data.subsidies.reduce((s, x) => s + x.amountCents, 0)}
		<div class="text-muted-foreground mt-2 text-xs">
			Active subsidies: {data.subsidies.length} record{data.subsidies.length === 1 ? '' : 's'}, total {formatCents(totalSubsidy)} transferred.
		</div>
	{/if}
</div>

<!-- Mobile: period chip -->
<form method="GET" class="mb-4 flex items-center gap-2 md:hidden">
	<label
		class="border-input bg-background relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm"
	>
		{data.periodMonth}
		<input
			type="month"
			name="period"
			value={data.periodMonth}
			onchange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
			class="absolute inset-0 cursor-pointer opacity-0"
		/>
	</label>
	{#if data.monthStartDay && data.monthStartDay !== 1}
		<span class="text-muted-foreground truncate text-xs">
			(cycle starts day {data.monthStartDay})
		</span>
	{/if}
</form>

<!-- Desktop: existing form with month input -->
<Card.Root class="mb-6 hidden md:block">
	<Card.Content class="p-4">
		<form method="GET" class="flex items-end gap-3">
			<div class="max-w-xs flex-1 space-y-1">
				<Label for="filter-period">Period</Label>
				<Input id="filter-period" type="month" name="period" value={data.periodMonth} />
			</div>
			<Button type="submit">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

<div class="grid gap-4 md:grid-cols-2">
	{#each sortedBudgets as budget (budget.id)}
		{@const cat = categoryById.get(budget.categoryId)}
		{@const spent = data.spentByCategory[budget.categoryId] ?? 0}
		{@const over = spent > budget.limitCents}
		{@const IconComp = getIconByName(cat?.icon) ?? Tag}
		{@const tint = cat?.color ?? '#8b5cf6'}
		{@const flow = flowOf(budget.id)}
		{@const carryover = budget.carryoverDeficitCents ?? 0}
		{@const denom = budget.limitCents + flow.in}
		<Card.Root class="relative">
			<a
				href="/budgets/{budget.id}"
				class="absolute inset-0 rounded-[inherit] z-0"
				aria-label="View {cat?.name ?? 'budget'} transactions"
			></a>
			<Card.Header class="flex flex-row items-start justify-between gap-3">
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-lg"
						style="background-color: {tint}20; color: {tint}"
					>
						<IconComp class="size-5" />
					</div>
					<div class="min-w-0">
						<Card.Title class="truncate">{cat?.name ?? 'Unknown'}</Card.Title>
						<Card.Description>{formatCents(Math.max(0, denom - spent - flow.out - carryover))} remaining</Card.Description>
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
						<DropdownMenu.Item onclick={() => openEdit(budget)}>
							<Pencil class="mr-2 size-4" /> Edit
						</DropdownMenu.Item>
						<form
							method="POST"
							action="?/delete"
							use:enhance={() =>
								async ({ result }) => {
									if (result.type === 'success') {
										await invalidateAll();
										notify.success('Budget deleted');
									} else if (result.type === 'failure') {
										const message = (result.data as { message?: string } | undefined)?.message;
										notify.error(message ?? 'Could not delete budget');
									}
								}}
						>
							<input type="hidden" name="id" value={budget.id} />
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
				{@const effLimit = effectiveLimit(budget.limitCents, flow) - carryover}
				{@const reducedLimit = budget.limitCents - carryover}
				{@const stillOver = spent + carryover > denom}
				{@const coveredByEff = over && !stillOver}
				{@const usedPct = denom === 0 ? (spent + flow.out + carryover > 0 ? 100 : 0) : Math.min(100, Math.round(((spent + flow.out + carryover) / denom) * 100))}
				<div class="mb-2 flex items-baseline justify-between text-sm tabular-nums">
					<span class={stillOver ? 'text-expense font-medium' : ''}>
						{formatCents(spent)}
					</span>
					<span class="text-muted-foreground">
						of {formatCents(reducedLimit)}
						{#if flow.in > 0 || flow.out > 0}
							<span class="text-xs">(eff {formatCents(effLimit)})</span>
						{/if}
					</span>
				</div>
				<div class="bg-muted relative h-2 overflow-hidden rounded-full">
					{#if stillOver}
						{@const carryPct = denom === 0 ? 0 : Math.min(100, Math.round((carryover / denom) * 100))}
						{#if carryPct > 0}
							<div class="absolute inset-y-0 left-0 h-full bg-orange-500/70" style="width: {carryPct}%"></div>
						{/if}
						<div class="absolute inset-y-0 h-full bg-amber-500" style="left: {carryPct}%; width: {100 - carryPct}%"></div>
						{@const overPct = denom === 0 ? 100 : Math.min(100, Math.round(((spent + carryover - denom) / denom) * 100))}
						<div
							class="absolute inset-y-0 right-0 h-full bg-rose-500 transition-all"
							style="width: {overPct}%"
						></div>
					{:else if coveredByEff}
						{@const carryPct = denom === 0 ? 0 : Math.min(100, Math.round((carryover / denom) * 100))}
						{@const redPct = denom === 0 ? 0 : Math.min(100 - carryPct, Math.round((budget.limitCents / denom) * 100))}
						{@const bluePct = denom === 0 ? 0 : Math.min(100 - carryPct - redPct, Math.round(((spent - budget.limitCents) / denom) * 100))}
						{#if carryPct > 0}
							<div class="absolute inset-y-0 left-0 h-full bg-orange-500/70" style="width: {carryPct}%"></div>
						{/if}
						<div class="absolute inset-y-0 h-full bg-rose-500" style="left: {carryPct}%; width: {redPct}%"></div>
						<div class="absolute inset-y-0 h-full bg-blue-500 transition-all" style="left: {carryPct + redPct}%; width: {bluePct}%"></div>
					{:else}
						{@const carryPct = denom === 0 ? 0 : Math.min(100, Math.round((carryover / denom) * 100))}
						{@const spentPct = denom === 0 ? 0 : Math.min(100 - carryPct, Math.round((spent / denom) * 100))}
						{@const outPct = denom === 0 ? 0 : Math.min(100 - carryPct - spentPct, Math.round((flow.out / denom) * 100))}
						{#if carryPct > 0}
							<div class="absolute inset-y-0 left-0 h-full bg-orange-500/70" style="width: {carryPct}%"></div>
						{/if}
						<div
							class="absolute inset-y-0 h-full transition-all {carryPct + spentPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}"
							style="left: {carryPct}%; width: {spentPct}%"
						></div>
						{#if flow.out > 0}
							<div
								class="absolute inset-y-0 h-full bg-purple-500 transition-all"
								style="left: {carryPct + spentPct}%; width: {outPct}%"
							></div>
						{/if}
					{/if}
				</div>
				<p class="text-muted-foreground mt-2 text-xs">
					{usedPct}% used{#if stillOver}
						· over by {formatCents(spent + carryover - denom)}{:else if coveredByEff}
						· covered by subsidy
					{/if}
				</p>
				{#if flow.in > 0}
					<p class="text-muted-foreground mt-1 text-xs">
						↓ subsidized {formatCents(flow.in)}
					</p>
				{/if}
				{#if flow.out > 0}
					<p class="text-muted-foreground mt-1 text-xs">
						↑ outgoing subsidy {formatCents(flow.out)}
					</p>
				{/if}
				{#if carryover > 0}
					<p class="mt-1 text-xs text-amber-500">
						⤴ carryover deficit {formatCents(carryover)}
					</p>
				{/if}
				{#if stillOver}
					{@const sources = eligibleSourcesFor(budget)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="mt-3 w-full"
						disabled={sources.length === 0}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							openSubsidy(budget);
						}}
					>
						Subsidize from another budget
					</Button>
				{/if}
				<SubsidyList
					entries={entriesForBudget(budget.id)}
					onEdit={openSubsidyEdit}
				/>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="md:col-span-2">
			<EmptyState
				icon={Target}
				title="No budgets for {data.periodMonth}"
				description="Set a monthly limit per expense category to track your spending."
			>
				<Button onclick={() => (createOpen = true)}>Add budget</Button>
			</EmptyState>
		</div>
	{/each}
</div>

{#if showDebtBudgetSuggestion}
	<div class="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
		<div class="mb-2 flex items-baseline justify-between gap-2">
			<h2 class="text-sm font-semibold text-amber-600 dark:text-amber-400">
				💳 Cover your debt minimums
			</h2>
			<span class="text-muted-foreground text-xs tabular-nums">
				{activeDebts.length} {activeDebts.length === 1 ? 'debt' : 'debts'}
			</span>
		</div>
		<p class="text-muted-foreground mb-3 text-xs">
			You have {formatCents(totalMinPayments)} in monthly debt minimums but no budget for
			them. Allocate them so you don't accidentally overspend elsewhere.
		</p>
		<form
			method="POST"
			action="?/setDebtBudget"
			use:enhance={() => async ({ result }) => {
				if (result.type === 'success') {
					await invalidateAll();
					notify.success('Debt payment budget set');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not set budget');
				}
			}}
		>
			<input type="hidden" name="limitCents" value={totalMinPayments} />
			<input type="hidden" name="periodMonth" value={data.periodMonth} />
			<Button type="submit" variant="outline" class="w-full">
				Set {formatCents(totalMinPayments)}/month for Debt Payment
			</Button>
		</form>
	</div>
{/if}

{#if data.unbudgetedCategories.length > 0}
	{@const totalUnbudgeted = data.unbudgetedCategories.reduce((s, c) => s + c.spentCents, 0)}
	<div class="mt-8">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-sm font-semibold">Unbudgeted spending</h2>
			<span class="text-muted-foreground text-xs tabular-nums">
				{data.unbudgetedCategories.length} {data.unbudgetedCategories.length === 1 ? 'category' : 'categories'} · {formatCents(totalUnbudgeted)}
			</span>
		</div>
		<p class="text-muted-foreground mb-4 text-xs">
			You spent on these without a budget. Set one to track future spending.
		</p>
		<div class="grid gap-4 md:grid-cols-2">
			{#each data.unbudgetedCategories as cat (cat.categoryId)}
				{@const Icon = getIconByName(cat.categoryIcon) ?? Tag}
				{@const tint = cat.categoryColor ?? '#94a3b8'}
				<Card.Root class="border-dashed">
					<Card.Header class="flex flex-row items-center gap-3">
						<div
							class="flex size-10 shrink-0 items-center justify-center rounded-lg"
							style="background-color: {tint}20; color: {tint}"
						>
							<Icon class="size-5" />
						</div>
						<div class="min-w-0 flex-1">
							<Card.Title class="truncate">{cat.categoryName}</Card.Title>
							<Card.Description>No limit set</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						<div class="mb-3 text-sm tabular-nums">
							<span class="text-expense font-medium">{formatCents(cat.spentCents)}</span>
							<span class="text-muted-foreground"> spent this period</span>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="w-full"
							onclick={() => {
								createCategoryId = cat.categoryId;
								createOpen = true;
							}}
						>
							Set budget
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>
{/if}

<!-- Create dialog/sheet -->
{#snippet createForm()}
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			createPending = true;
			return async ({ result }) => {
				createPending = false;
				if (result.type === 'success') {
					await invalidateAll();
					createOpen = false;
					notify.success('Budget created');
				} else if (result.type === 'failure') {
					const message = (result.data as { message?: string } | undefined)?.message;
					notify.error(message ?? 'Could not create budget');
				}
			};
		}}
		class="space-y-4 p-4"
	>
		<div class="space-y-1">
			<Label>Category</Label>
			<PickerSheet
				items={expenseCategoryItems}
				bind:value={createCategoryId}
				name="categoryId"
				placeholder="Select category"
				title="Category"
				searchable
			/>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<Label for="budget-c-period">Period</Label>
				<Input
					id="budget-c-period"
					type="month"
					name="periodMonth"
					required
					value={data.periodMonth}
				/>
			</div>
			<div class="space-y-1">
				<Label for="budget-c-limit">Limit</Label>
				<MoneyInput
					id="budget-c-limit"
					name="limitCents"
					min={1}
					required
					class="h-12 text-lg md:h-12 md:text-lg"
				/>
			</div>
		</div>
		<div class="flex gap-2 pt-2">
			<Button
				type="button"
				variant="outline"
				onclick={() => (createOpen = false)}
				class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
			>
				Cancel
			</Button>
			<SubmitButton
				pending={createPending}
				class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
			>
				Create
			</SubmitButton>
		</div>
	</form>
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={createOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>New budget</Dialog.Title></Dialog.Header>
			{@render createForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={createOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>New budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render createForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

<!-- Edit dialog/sheet -->
{#snippet editForm()}
	{#if editTarget}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				editPending = true;
				return async ({ result }) => {
					editPending = false;
					if (result.type === 'success') {
						await invalidateAll();
						editOpen = false;
						notify.success('Budget updated');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not update budget');
					}
				};
			}}
			class="space-y-4 p-4"
		>
			<input type="hidden" name="id" value={editTarget.id} />
			<div class="space-y-1">
				<Label>Category</Label>
				<PickerSheet
					items={expenseCategoryItems}
					bind:value={editCategoryId}
					name="categoryId"
					placeholder="Select category"
					title="Category"
					searchable
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="budget-e-period">Period</Label>
					<Input
						id="budget-e-period"
						type="month"
						name="periodMonth"
						required
						value={editTarget.periodMonth}
					/>
				</div>
				<div class="space-y-1">
					<Label for="budget-e-limit">Limit</Label>
					<MoneyInput
						id="budget-e-limit"
						name="limitCents"
						min={1}
						required
						value={editTarget.limitCents}
						class="h-12 text-lg md:h-12 md:text-lg"
					/>
				</div>
			</div>
			<div class="flex gap-2 pt-2">
				<Button
					type="button"
					variant="outline"
					onclick={() => (editOpen = false)}
					class="h-12 flex-1 rounded-full text-base font-semibold md:h-10 md:text-sm"
				>
					Cancel
				</Button>
				<SubmitButton
					pending={editPending}
					class="h-12 flex-1 rounded-full !bg-white text-base font-semibold !text-neutral-900 hover:!bg-white/90 md:h-10 md:text-sm"
				>
					Save
				</SubmitButton>
			</div>
		</form>
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={editOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit budget</Dialog.Title></Dialog.Header>
			{@render editForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={editOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Edit budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render editForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

{#snippet subsidyForm()}
	{#if subsidyTarget}
		{@const flow = flowOf(subsidyTarget.id)}
		{@const spent = data.spentByCategory[subsidyTarget.categoryId] ?? 0}
		{@const overage = spent - subsidyTarget.limitCents}
		{@const cat = categoryById.get(subsidyTarget.categoryId)}
		<SubsidyCreateForm
			targetBudgetId={subsidyTarget.id}
			targetCategoryName={cat?.name ?? 'Unknown'}
			targetOverageCents={Math.max(0, overage)}
			alreadyCoveredCents={flow.in}
			eligibleSources={eligibleSourcesFor(subsidyTarget)}
			onClose={() => (subsidyOpen = false)}
		/>
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={subsidyOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Subsidize budget</Dialog.Title></Dialog.Header>
			{@render subsidyForm()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={subsidyOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Subsidize budget</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render subsidyForm()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

{#snippet subsidyEditFormSnippet()}
	{#if subsidyEditTarget}
		{@const fromBudget = budgetById.get(subsidyEditTarget.fromBudgetId)}
		{@const toBudget = budgetById.get(subsidyEditTarget.toBudgetId)}
		{@const fromCat = fromBudget ? categoryById.get(fromBudget.categoryId) : null}
		{@const toCat = toBudget ? categoryById.get(toBudget.categoryId) : null}
		{@const fromSpent = fromBudget ? (data.spentByCategory[fromBudget.categoryId] ?? 0) : 0}
		{@const fromFlowOut = fromBudget ? (data.subsidyFlowByBudget[fromBudget.id]?.out ?? 0) : 0}
		{@const remainingExclSelf =
			(fromBudget?.limitCents ?? 0) - fromSpent - fromFlowOut + subsidyEditTarget.amountCents}
		{#key subsidyEditTarget.id}
			<SubsidyEditForm
				subsidyId={subsidyEditTarget.id}
				fromName={fromCat?.name ?? 'Unknown'}
				toName={toCat?.name ?? 'Unknown'}
				currentAmountCents={subsidyEditTarget.amountCents}
				sourceRemainingExclSelfCents={remainingExclSelf}
				currentNote={subsidyEditTarget.note}
				onClose={() => (subsidyEditOpen = false)}
			/>
		{/key}
	{/if}
{/snippet}

{#if isDesktop.current}
	<Dialog.Root bind:open={subsidyEditOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit subsidy</Dialog.Title></Dialog.Header>
			{@render subsidyEditFormSnippet()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={subsidyEditOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Edit subsidy</Sheet.Title></Sheet.Header>
			<div class="flex-1 overflow-y-auto">{@render subsidyEditFormSnippet()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
