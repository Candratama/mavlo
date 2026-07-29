<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		ArrowLeft,
		Pencil,
		Trash2,
		MoreHorizontal,
		Tag,
		Target,
		AlertTriangle,
		CheckCircle2
	} from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { getCycleForPeriod, formatYmdInTimezone } from '$lib/utils/cycle.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';
	import { effectiveLimit, sourceRemaining } from '$lib/utils/budget.js';
	import SubsidyList from '$lib/components/budgets/subsidy-list.svelte';
	import SubsidyCreateForm from '$lib/components/budgets/subsidy-create-form.svelte';
	import SubsidyEditForm from '$lib/components/budgets/subsidy-edit-form.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Sheet from '$lib/components/ui/sheet';
	import { MediaQuery } from 'svelte/reactivity';

	let { data } = $props();

	type TxRow = (typeof data.transactions)[number];

	const budgetId = $derived(page.params.id);
	// budgetView is set when this budget belongs to a non-current period; the
	// layout only carries current-cycle data.
	const budgetView = $derived(data.budgetView);
	const budget = $derived(budgetView?.budget ?? data.budgets.find((b) => b.id === budgetId));
	const periodBudgets = $derived(budgetView?.budgets ?? data.budgets);
	const spentByCategory = $derived(budgetView?.spentByCategory ?? data.spentByCategory);
	const subsidies = $derived(budgetView?.subsidies ?? data.subsidies);
	const subsidyFlowByBudget = $derived(budgetView?.subsidyFlowByBudget ?? data.subsidyFlowByBudget);
	const category = $derived(
		budget ? data.allCategories.find((c) => c.id === budget.categoryId) : undefined
	);
	const tint = $derived(category?.color ?? '#8b5cf6');

	const timezone = $derived(data.timezone ?? 'Asia/Jakarta');
	const accountById = $derived(new Map(data.allAccounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.allCategories.map((c) => [c.id, c])));

	// Transactions within the budget's own cycle period (not necessarily the
	// current cycle) that match the budget's category. Cycle end is exclusive.
	const budgetCycle = $derived(
		budget ? getCycleForPeriod(budget.periodMonth, data.monthStartDay ?? 1, timezone) : null
	);
	const budgetTransactions = $derived(
		budget && budgetCycle
			? data.transactions
					.filter(
						(t) =>
							t.categoryId === budget.categoryId &&
							t.kind === 'expense' &&
							t.occurredAt >= budgetCycle.start.getTime() &&
							t.occurredAt < budgetCycle.end.getTime()
					)
					.sort((a, b) => b.occurredAt - a.occurredAt)
			: []
	);

	const spentCents = $derived(budgetTransactions.reduce((s, t) => s + t.amountCents, 0));
	const limitCents = $derived(budget?.limitCents ?? 0);
	const over = $derived(spentCents > limitCents);

	const isDesktop = new MediaQuery('(min-width: 768px)');

	type SubsidyRow = (typeof data.subsidies)[number];

	const budgetById = $derived(new Map(periodBudgets.map((b) => [b.id, b])));
	const allCategoriesById = $derived(new Map(data.allCategories.map((c) => [c.id, c])));

	const flow = $derived(
		budget ? (subsidyFlowByBudget[budget.id] ?? { in: 0, out: 0 }) : { in: 0, out: 0 }
	);
	const carryover = $derived(budget?.carryoverDeficitCents ?? 0);
	const effLimit = $derived(budget ? effectiveLimit(budget.limitCents, flow) - carryover : 0);
	const denom = $derived((budget?.limitCents ?? 0) + flow.in);
	const stillOver = $derived(spentCents + carryover > denom);
	const coveredByEff = $derived(over && !stillOver);
	const effPct = $derived(
		denom === 0
			? spentCents + flow.out + carryover > 0
				? 100
				: 0
			: Math.min(100, Math.round(((spentCents + flow.out + carryover) / denom) * 100))
	);

	const subsidiesIn = $derived(budget ? subsidies.filter((s) => s.toBudgetId === budget.id) : []);
	const subsidiesOut = $derived(
		budget ? subsidies.filter((s) => s.fromBudgetId === budget.id) : []
	);

	const eligibleSources = $derived.by(() => {
		if (!budget) return [];
		return periodBudgets
			.filter((b) => b.id !== budget.id && b.periodMonth === budget.periodMonth)
			.map((b) => {
				const spentB = spentByCategory[b.categoryId] ?? 0;
				const out = subsidyFlowByBudget[b.id]?.out ?? 0;
				const carryover = b.carryoverDeficitCents ?? 0;
				const remaining = sourceRemaining({
					limitCents: b.limitCents - carryover,
					spentCents: spentB,
					subsidyOutCents: out
				});
				const cat = allCategoriesById.get(b.categoryId);
				return {
					budgetId: b.id,
					categoryName: cat?.name ?? 'Unknown',
					categoryIcon: cat?.icon ?? null,
					sourceRemainingCents: remaining
				};
			})
			.filter((s) => s.sourceRemainingCents > 0);
	});

	let subsidyOpen = $state(false);
	let subsidyEditOpen = $state(false);
	let clearCarryoverOpen = $state(false);
	let subsidyEditTarget = $state<SubsidyRow | null>(null);

	const openSubsidyEdit = (id: string) => {
		subsidyEditTarget = subsidies.find((s) => s.id === id) ?? null;
		subsidyEditOpen = subsidyEditTarget !== null;
	};

	const entries = $derived.by(() => {
		const list: {
			id: string;
			direction: 'in' | 'out';
			counterpartName: string;
			amountCents: number;
			note: string | null;
		}[] = [];
		for (const s of subsidiesIn) {
			const fromB = budgetById.get(s.fromBudgetId);
			const cat = fromB ? allCategoriesById.get(fromB.categoryId) : null;
			list.push({
				id: s.id,
				direction: 'in',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		for (const s of subsidiesOut) {
			const toB = budgetById.get(s.toBudgetId);
			const cat = toB ? allCategoriesById.get(toB.categoryId) : null;
			list.push({
				id: s.id,
				direction: 'out',
				counterpartName: cat?.name ?? 'Unknown',
				amountCents: s.amountCents,
				note: s.note
			});
		}
		return list;
	});

	const currency = $derived(data.accounts[0]?.currency ?? 'IDR');

	type DayGroup = { key: string; dateLabel: string; totalCents: number; items: TxRow[] };

	const groupedByDay = $derived.by<DayGroup[]>(() => {
		const byDay = new SvelteMap<string, DayGroup>();
		for (const tx of budgetTransactions) {
			const key = formatYmdInTimezone(new Date(tx.occurredAt), timezone);
			let g = byDay.get(key);
			if (!g) {
				g = {
					key,
					dateLabel: new Date(tx.occurredAt).toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric',
						year: 'numeric',
						timeZone: timezone
					}),
					totalCents: 0,
					items: []
				};
				byDay.set(key, g);
			}
			g.items.push(tx);
			g.totalCents += tx.amountCents;
		}
		return Array.from(byDay.values()).sort((a, b) => b.key.localeCompare(a.key));
	});

	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editOpen = true;
	};

	const CatIcon = $derived(category?.icon ? (getIconByName(category.icon) ?? Tag) : Tag);
</script>

<svelte:head>
	<title>{category?.name ?? 'Budget'} Budget — Mavlo</title>
</svelte:head>

<div class="mb-6">
	<Button variant="ghost" size="sm" class="mb-3 -ml-2" href="/budgets">
		<ArrowLeft class="mr-1 size-4" /> Budgets
	</Button>

	{#if budget && category}
		<div class="mavlo-pill relative overflow-hidden rounded-2xl p-5" style="min-height: 120px;">
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 opacity-70"
				style="background: radial-gradient(ellipse 70% 60% at 0% 0%, {tint}33, transparent 60%), radial-gradient(circle 50% at 100% 100%, {tint}22, transparent 70%);"
			></div>
			<div
				aria-hidden="true"
				class="pointer-events-none absolute -right-10 -bottom-10 size-40 rounded-full opacity-20 blur-2xl"
				style="background: {tint}"
			></div>

			<div class="relative z-10 flex items-start justify-between gap-4">
				<div class="flex items-center gap-3">
					<div
						class="flex size-12 items-center justify-center rounded-xl border backdrop-blur"
						style="background-color: {tint}26; border-color: {tint}40; color: {tint}"
					>
						<CatIcon class="size-6" />
					</div>
					<div>
						<div class="text-muted-foreground text-xs tracking-wider uppercase">
							Budget · {budget.periodMonth}
						</div>
						<div class="text-xl leading-tight font-semibold">{category.name}</div>
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if over}
						<div class="flex size-8 items-center justify-center rounded-full bg-rose-500/20">
							<AlertTriangle class="size-4 text-rose-500" />
						</div>
					{:else if effPct === 100}
						<div class="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
							<CheckCircle2 class="size-4 text-emerald-500" />
						</div>
					{:else}
						<div
							class="flex size-8 items-center justify-center rounded-full"
							style="background-color: {tint}20"
						>
							<Target class="size-4" style="color: {tint}" />
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

{#if budget}
	<!-- Budget progress -->
	<div
		class="mb-6 rounded-xl border bg-gradient-to-br {stillOver
			? 'from-rose-500/10'
			: coveredByEff
				? 'from-blue-500/10'
				: effPct >= 80
					? 'from-amber-500/10'
					: 'from-emerald-500/10'} via-card to-card p-4"
	>
		<div class="mb-3 flex items-baseline justify-between">
			<span class="text-sm font-semibold">Spent this cycle</span>
			<span class="text-sm font-semibold tabular-nums {stillOver ? 'text-expense' : ''}">
				{effPct}%
			</span>
		</div>
		<div class="bg-muted relative mb-3 h-2.5 overflow-hidden rounded-full">
			{#if stillOver}
				{@const carryPct = denom === 0 ? 0 : Math.min(100, Math.round((carryover / denom) * 100))}
				{#if carryPct > 0}
					<div
						class="absolute inset-y-0 left-0 h-full bg-orange-500/70"
						style="width: {carryPct}%"
					></div>
				{/if}
				<div
					class="absolute inset-y-0 h-full bg-amber-500"
					style="left: {carryPct}%; width: {100 - carryPct}%"
				></div>
				{@const overPct =
					denom === 0
						? 100
						: Math.min(100, Math.round(((spentCents + carryover - denom) / denom) * 100))}
				<div
					class="absolute inset-y-0 right-0 h-full rounded-full bg-rose-500 transition-all"
					style="width: {overPct}%"
				></div>
			{:else if coveredByEff}
				{@const carryPct = denom === 0 ? 0 : Math.min(100, Math.round((carryover / denom) * 100))}
				{@const redPct =
					denom === 0 ? 0 : Math.min(100 - carryPct, Math.round((budget.limitCents / denom) * 100))}
				{@const bluePct =
					denom === 0
						? 0
						: Math.min(
								100 - carryPct - redPct,
								Math.round(((spentCents - budget.limitCents) / denom) * 100)
							)}
				{#if carryPct > 0}
					<div
						class="absolute inset-y-0 left-0 h-full bg-orange-500/70"
						style="width: {carryPct}%"
					></div>
				{/if}
				<div
					class="absolute inset-y-0 h-full bg-rose-500"
					style="left: {carryPct}%; width: {redPct}%"
				></div>
				<div
					class="absolute inset-y-0 h-full rounded-full bg-blue-500 transition-all"
					style="left: {carryPct + redPct}%; width: {bluePct}%"
				></div>
			{:else}
				{@const carryPct = denom === 0 ? 0 : Math.min(100, Math.round((carryover / denom) * 100))}
				{@const spentPct =
					denom === 0 ? 0 : Math.min(100 - carryPct, Math.round((spentCents / denom) * 100))}
				{@const outPct =
					denom === 0
						? 0
						: Math.min(100 - carryPct - spentPct, Math.round((flow.out / denom) * 100))}
				{#if carryPct > 0}
					<div
						class="absolute inset-y-0 left-0 h-full bg-orange-500/70"
						style="width: {carryPct}%"
					></div>
				{/if}
				<div
					class="absolute inset-y-0 h-full rounded-full transition-all {carryPct + spentPct >= 80
						? 'bg-amber-500'
						: 'bg-emerald-500'}"
					style="left: {carryPct}%; width: {spentPct}%"
				></div>
				{#if flow.out > 0}
					<div
						class="absolute inset-y-0 h-full rounded-full bg-purple-500 transition-all"
						style="left: {carryPct + spentPct}%; width: {outPct}%"
					></div>
				{/if}
			{/if}
		</div>
		<div class="grid grid-cols-3 gap-3 text-xs">
			<div>
				<div class="text-muted-foreground tracking-wider uppercase">Spent</div>
				<div class="mt-1 font-semibold tabular-nums {stillOver ? 'text-expense' : ''}">
					{formatCentsAsCurrency(spentCents, currency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground tracking-wider uppercase">Limit</div>
				<div class="mt-1 font-semibold tabular-nums">
					{formatCentsAsCurrency(limitCents - carryover, currency)}
				</div>
				{#if flow.in > 0 || flow.out > 0}
					<div class="text-muted-foreground text-[10px]">
						eff {formatCentsAsCurrency(effLimit, currency)}
					</div>
				{/if}
			</div>
			<div>
				<div class="text-muted-foreground tracking-wider uppercase">
					{stillOver ? 'Over by' : 'Left'}
				</div>
				<div class="mt-1 font-semibold tabular-nums {stillOver ? 'text-expense' : 'text-income'}">
					{#if stillOver}
						−{formatCentsAsCurrency(spentCents + carryover - denom, currency)}
					{:else}
						{formatCentsAsCurrency(
							Math.max(0, denom - spentCents - flow.out - carryover),
							currency
						)}
					{/if}
				</div>
			</div>
		</div>
		{#if carryover > 0}
			<div class="mt-3 flex items-center gap-1 text-xs text-amber-500">
				⤴ Carryover deficit from {budget?.carryoverFromPeriod}: {formatCentsAsCurrency(
					carryover,
					currency
				)}
				<button
					type="button"
					class="ml-1 rounded-full p-0.5 hover:bg-amber-100"
					onclick={() => {
						clearCarryoverOpen = true;
					}}
					aria-label="Hapus carryover">×</button
				>
			</div>
		{/if}
	</div>
{/if}

{#if budget}
	<div class="bg-card mb-6 rounded-xl border p-4">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold">Subsidies</h2>
			{#if stillOver}
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={eligibleSources.length === 0}
					onclick={() => (subsidyOpen = true)}
				>
					+ Subsidize from another budget
				</Button>
			{/if}
		</div>
		{#if entries.length === 0}
			<p class="text-muted-foreground text-xs">No subsidies for this budget yet.</p>
		{:else}
			<SubsidyList {entries} onEdit={openSubsidyEdit} />
		{/if}
	</div>
{/if}

<div class="space-y-5">
	{#each groupedByDay as group (group.key)}
		<section>
			<div class="mb-2 flex items-baseline justify-between gap-2 px-1">
				<span class="text-muted-foreground truncate text-xs">{group.dateLabel}</span>
				<span class="text-expense text-xs font-semibold whitespace-nowrap tabular-nums">
					−{formatCentsAsCurrency(group.totalCents, currency)}
				</span>
			</div>
			<ul class="space-y-2">
				{#each group.items as tx (tx.id)}
					{@const acc = accountById.get(tx.accountId)}
					{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
					{@const RowIcon = getIconByName(cat?.icon) ?? Tag}
					{@const rowTint = cat?.color ?? '#94a3b8'}
					<li class="bg-card flex items-center gap-3 rounded-lg border p-3">
						<div
							class="flex size-10 shrink-0 items-center justify-center rounded-lg"
							style="background-color: {rowTint}20; color: {rowTint}"
						>
							<RowIcon class="size-5" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">
								{tx.note || cat?.name || acc?.name || 'Transaction'}
							</div>
							<div class="text-muted-foreground truncate text-xs">
								{acc?.name ?? '—'}
							</div>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<span class="text-expense text-sm font-semibold whitespace-nowrap tabular-nums">
								−{formatCentsAsCurrency(tx.amountCents, acc?.currency ?? currency)}
							</span>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon"
											class="size-11 shrink-0 md:size-8"
										>
											<MoreHorizontal class="size-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<DropdownMenu.Item onclick={() => openEdit(tx)}>
										<Pencil class="mr-2 size-4" /> Edit
									</DropdownMenu.Item>
									<form
										method="POST"
										action="/transactions?/delete"
										use:enhance={() =>
											async ({ result }) => {
												if (result.type === 'success') {
													await invalidateAll();
													notify.success('Transaction deleted');
												} else if (result.type === 'failure') {
													const message = (result.data as { message?: string } | undefined)
														?.message;
													notify.error(message ?? 'Could not delete transaction');
												}
											}}
									>
										<input type="hidden" name="id" value={tx.id} />
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
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<EmptyState
			icon={Target}
			title="No expenses yet"
			description="Expense transactions in this budget category will appear here."
		/>
	{/each}
</div>

<AddTransactionSheet
	bind:open={editOpen}
	mode="edit"
	accounts={data.accounts}
	categories={data.categories}
	editTarget={editTarget
		? {
				id: editTarget.id,
				kind: editTarget.kind,
				amountCents: editTarget.amountCents,
				accountId: editTarget.accountId,
				transferToAccountId: editTarget.transferToAccountId,
				categoryId: editTarget.categoryId,
				occurredAt: editTarget.occurredAt,
				note: editTarget.note
			}
		: null}
	actionUrl="/transactions?/update"
	onClose={() => (editOpen = false)}
/>

{#snippet subsidyCreateSnippet()}
	{#if budget}
		{@const overage = spentCents - budget.limitCents}
		{@const cat = allCategoriesById.get(budget.categoryId)}
		<SubsidyCreateForm
			targetBudgetId={budget.id}
			targetCategoryName={cat?.name ?? 'Unknown'}
			targetOverageCents={Math.max(0, overage)}
			alreadyCoveredCents={flow.in}
			{eligibleSources}
			onClose={() => (subsidyOpen = false)}
		/>
	{/if}
{/snippet}

{#snippet subsidyEditSnippet()}
	{#if subsidyEditTarget && budget}
		{@const fromBudget = budgetById.get(subsidyEditTarget.fromBudgetId)}
		{@const toBudget = budgetById.get(subsidyEditTarget.toBudgetId)}
		{@const fromCat = fromBudget ? allCategoriesById.get(fromBudget.categoryId) : null}
		{@const toCat = toBudget ? allCategoriesById.get(toBudget.categoryId) : null}
		{@const fromSpent = fromBudget ? (spentByCategory[fromBudget.categoryId] ?? 0) : 0}
		{@const fromFlowOut = fromBudget ? (subsidyFlowByBudget[fromBudget.id]?.out ?? 0) : 0}
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
	<Dialog.Root bind:open={subsidyOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Subsidize budget</Dialog.Title></Dialog.Header>
			{@render subsidyCreateSnippet()}
		</Dialog.Content>
	</Dialog.Root>
	<Dialog.Root bind:open={subsidyEditOpen}>
		<Dialog.Content>
			<Dialog.Header><Dialog.Title>Edit subsidy</Dialog.Title></Dialog.Header>
			{@render subsidyEditSnippet()}
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<Sheet.Root bind:open={subsidyOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"
				><Sheet.Title>Subsidize budget</Sheet.Title></Sheet.Header
			>
			<div class="flex-1 overflow-y-auto">{@render subsidyCreateSnippet()}</div>
		</Sheet.Content>
	</Sheet.Root>
	<Sheet.Root bind:open={subsidyEditOpen}>
		<Sheet.Content
			side="bottom"
			class="flex max-h-[calc(90dvh-var(--keyboard-h,0px))] flex-col p-0"
		>
			<Sheet.Header class="p-4 pb-2 text-left"><Sheet.Title>Edit subsidy</Sheet.Title></Sheet.Header
			>
			<div class="flex-1 overflow-y-auto">{@render subsidyEditSnippet()}</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}

<AlertDialog.Root bind:open={clearCarryoverOpen}>
	<AlertDialog.Portal>
		<AlertDialog.Overlay />
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Hapus Carryover?</AlertDialog.Title>
				<AlertDialog.Description>
					Defisit <strong>{formatCentsAsCurrency(carryover, currency)}</strong>
					dari period <strong>{budget?.carryoverFromPeriod ?? ''}</strong> tidak akan diperhitungkan di
					bulan ini. Transaksi tidak terpengaruh.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Batal</AlertDialog.Cancel>
				<form
					method="POST"
					action="?/clearCarryover"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'failure') {
								notify.error(
									(result.data as { message?: string })?.message ?? 'Failed to clear carryover'
								);
								return;
							}
							clearCarryoverOpen = false;
							await invalidateAll();
						};
					}}
				>
					<input type="hidden" name="id" value={budgetId} />
					<AlertDialog.Action type="submit">Hapus Carryover</AlertDialog.Action>
				</form>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
