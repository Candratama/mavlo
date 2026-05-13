<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		ArrowLeft,
		ArrowLeftRight,
		ArrowDown,
		ArrowUp,
		Pencil,
		Trash2,
		MoreHorizontal,
		Tag,
		Target,
		AlertTriangle,
		CheckCircle2
	} from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';

	let { data } = $props();

	type TxRow = (typeof data.transactions)[number];

	const budgetId = $derived(page.params.id);
	const budget = $derived(data.budgets.find((b) => b.id === budgetId));
	const category = $derived(
		budget ? data.allCategories.find((c) => c.id === budget.categoryId) : undefined
	);
	const tint = $derived(category?.color ?? '#8b5cf6');

	const accountById = $derived(new Map(data.allAccounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.allCategories.map((c) => [c.id, c])));

	// Transactions within the budget's cycle period that match the budget's category
	const budgetTransactions = $derived(
		budget
			? data.transactions
					.filter(
						(t) =>
							t.categoryId === budget.categoryId &&
							t.kind === 'expense' &&
							t.occurredAt >= data.cycle.startMs &&
							t.occurredAt <= data.cycle.endMs
					)
					.sort((a, b) => b.occurredAt - a.occurredAt)
			: []
	);

	const spentCents = $derived(
		budgetTransactions.reduce((s, t) => s + t.amountCents, 0)
	);
	const limitCents = $derived(budget?.limitCents ?? 0);
	const pct = $derived(limitCents > 0 ? Math.min(100, Math.round((spentCents / limitCents) * 100)) : 0);
	const over = $derived(spentCents > limitCents);
	const remainingCents = $derived(Math.max(0, limitCents - spentCents));

	const currency = $derived(data.accounts[0]?.currency ?? 'IDR');

	type DayGroup = { key: string; dateLabel: string; totalCents: number; items: TxRow[] };

	const groupedByDay = $derived.by<DayGroup[]>(() => {
		const byDay = new SvelteMap<string, DayGroup>();
		for (const tx of budgetTransactions) {
			const key = new Date(tx.occurredAt).toISOString().slice(0, 10);
			let g = byDay.get(key);
			if (!g) {
				const date = new Date(`${key}T00:00:00.000Z`);
				g = {
					key,
					dateLabel: date.toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric',
						year: 'numeric',
						timeZone: 'UTC'
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

	const CatIcon = $derived(
		category?.icon ? (getIconByName(category.icon) ?? Tag) : Tag
	);
</script>

<svelte:head>
	<title>{category?.name ?? 'Budget'} Budget — Mavlo</title>
</svelte:head>

<div class="mb-6">
	<Button variant="ghost" size="sm" class="-ml-2 mb-3" href="/budgets">
		<ArrowLeft class="mr-1 size-4" /> Budgets
	</Button>

	{#if budget && category}
		<div
			class="mavlo-pill relative overflow-hidden rounded-2xl p-5"
			style="min-height: 120px;"
		>
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
					{:else if pct === 100}
						<div class="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
							<CheckCircle2 class="size-4 text-emerald-500" />
						</div>
					{:else}
						<div class="flex size-8 items-center justify-center rounded-full" style="background-color: {tint}20">
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
		class="mb-6 rounded-xl border bg-gradient-to-br {over ? 'from-rose-500/10' : pct >= 80 ? 'from-amber-500/10' : 'from-emerald-500/10'} via-card to-card p-4"
	>
		<div class="mb-3 flex items-baseline justify-between">
			<span class="text-sm font-semibold">Spent this cycle</span>
			<span class="text-sm font-semibold tabular-nums {over ? 'text-expense' : ''}">
				{pct}%
			</span>
		</div>
		<div class="bg-muted relative mb-3 h-2.5 overflow-hidden rounded-full">
			{#if over}
				<div class="absolute inset-y-0 left-0 h-full rounded-full bg-amber-500" style="width: 100%"></div>
				{@const overPct = Math.min(100, Math.round(((spentCents - limitCents) / limitCents) * 100))}
				<div class="absolute inset-y-0 right-0 h-full rounded-full bg-rose-500 transition-all" style="width: {overPct}%"></div>
			{:else}
				<div
					class="h-full rounded-full transition-all {pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}"
					style="width: {pct}%"
				></div>
			{/if}
		</div>
		<div class="grid grid-cols-3 gap-3 text-xs">
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">Spent</div>
				<div class="mt-1 font-semibold tabular-nums {over ? 'text-expense' : ''}">
					{formatCentsAsCurrency(spentCents, currency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">Limit</div>
				<div class="mt-1 font-semibold tabular-nums">
					{formatCentsAsCurrency(limitCents, currency)}
				</div>
			</div>
			<div>
				<div class="text-muted-foreground uppercase tracking-wider">{over ? 'Over by' : 'Left'}</div>
				<div class="mt-1 font-semibold tabular-nums {over ? 'text-expense' : 'text-income'}">
					{#if over}
						−{formatCentsAsCurrency(spentCents - limitCents, currency)}
					{:else}
						{formatCentsAsCurrency(remainingCents, currency)}
					{/if}
				</div>
			</div>
		</div>
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
										<Button {...props} variant="ghost" size="icon" class="size-11 shrink-0 md:size-8">
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
													const message = (result.data as { message?: string } | undefined)?.message;
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
