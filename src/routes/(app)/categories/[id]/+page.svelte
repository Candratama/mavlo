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
		Tag
	} from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { formatYmdInTimezone } from '$lib/utils/cycle.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';

	let { data } = $props();

	type TxRow = (typeof data.transactions)[number];

	const categoryId = $derived(page.params.id);
	const category = $derived(data.allCategories.find((c) => c.id === categoryId));
	const tint = $derived(category?.color ?? '#8b5cf6');

	const accountById = $derived(new Map(data.allAccounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.allCategories.map((c) => [c.id, c])));

	const categoryTransactions = $derived(
		data.transactions
			.filter((t) => t.categoryId === categoryId)
			.sort((a, b) => b.occurredAt - a.occurredAt)
	);

	const totalIncome = $derived(
		categoryTransactions.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountCents, 0)
	);
	const totalExpense = $derived(
		categoryTransactions.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amountCents, 0)
	);

	const currency = $derived(data.accounts[0]?.currency ?? 'IDR');
	const timezone = $derived(data.timezone ?? 'Asia/Jakarta');

	type DayGroup = { key: string; dateLabel: string; netCents: number; items: TxRow[] };

	const groupedByDay = $derived.by<DayGroup[]>(() => {
		const byDay = new SvelteMap<string, DayGroup>();
		for (const tx of categoryTransactions) {
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
					netCents: 0,
					items: []
				};
				byDay.set(key, g);
			}
			g.items.push(tx);
			if (tx.kind === 'income') g.netCents += tx.amountCents;
			else if (tx.kind === 'expense') g.netCents -= tx.amountCents;
		}
		return Array.from(byDay.values()).sort((a, b) => b.key.localeCompare(a.key));
	});

	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editOpen = true;
	};

	const IconComp = $derived(category?.icon ? (getIconByName(category.icon) ?? Tag) : Tag);
</script>

<svelte:head>
	<title>{category?.name ?? 'Category'} — Mavlo</title>
</svelte:head>

<div class="mb-6">
	<Button variant="ghost" size="sm" class="mb-3 -ml-2" href="/categories">
		<ArrowLeft class="mr-1 size-4" /> Categories
	</Button>

	{#if category}
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
						<IconComp class="size-6" />
					</div>
					<div>
						<div class="text-muted-foreground text-xs tracking-wider uppercase">
							{category.kind}
						</div>
						<div class="text-xl leading-tight font-semibold">{category.name}</div>
					</div>
				</div>
				<div class="flex flex-col items-end">
					<div class="text-2xl font-semibold tracking-tight tabular-nums">
						{categoryTransactions.length}
					</div>
					<span class="mt-1 text-xs font-semibold tracking-wider" style="color: {tint}">
						transactions
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<div class="mb-6 grid grid-cols-2 gap-3">
	{#if category?.kind === 'income' || (totalIncome > 0 && totalExpense > 0)}
		<div class="via-card to-card rounded-xl border bg-gradient-to-br from-emerald-500/10 p-4">
			<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
				<span class="bg-income/15 inline-flex size-6 items-center justify-center rounded-full">
					<ArrowDown class="text-income size-3.5" />
				</span>
				Income
			</div>
			<p class="mt-2 text-lg font-semibold tabular-nums">
				{formatCentsAsCurrency(totalIncome, currency)}
			</p>
		</div>
	{/if}
	{#if category?.kind === 'expense' || (totalIncome > 0 && totalExpense > 0)}
		<div class="via-card to-card rounded-xl border bg-gradient-to-br from-rose-500/10 p-4">
			<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
				<span class="bg-expense/15 inline-flex size-6 items-center justify-center rounded-full">
					<ArrowUp class="text-expense size-3.5" />
				</span>
				Expense
			</div>
			<p class="mt-2 text-lg font-semibold tabular-nums">
				{formatCentsAsCurrency(totalExpense, currency)}
			</p>
		</div>
	{/if}
	{#if category?.kind === 'income' && totalExpense === 0}
		<div
			class="via-card to-card rounded-xl border bg-gradient-to-br from-rose-500/10 p-4 opacity-40"
		>
			<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
				<span class="bg-expense/15 inline-flex size-6 items-center justify-center rounded-full">
					<ArrowUp class="text-expense size-3.5" />
				</span>
				Expense
			</div>
			<p class="mt-2 text-lg font-semibold tabular-nums">
				{formatCentsAsCurrency(0, currency)}
			</p>
		</div>
	{/if}
	{#if category?.kind === 'expense' && totalIncome === 0}
		<div
			class="via-card to-card rounded-xl border bg-gradient-to-br from-emerald-500/10 p-4 opacity-40"
		>
			<div class="text-muted-foreground flex items-center gap-2 text-xs tracking-wider uppercase">
				<span class="bg-income/15 inline-flex size-6 items-center justify-center rounded-full">
					<ArrowDown class="text-income size-3.5" />
				</span>
				Income
			</div>
			<p class="mt-2 text-lg font-semibold tabular-nums">
				{formatCentsAsCurrency(0, currency)}
			</p>
		</div>
	{/if}
</div>

<div class="space-y-5">
	{#each groupedByDay as group (group.key)}
		<section>
			<div class="mb-2 flex items-baseline justify-between gap-2 px-1">
				<span class="text-muted-foreground truncate text-xs">{group.dateLabel}</span>
				{#if group.netCents !== 0}
					<span
						class="text-xs font-semibold whitespace-nowrap tabular-nums {group.netCents >= 0
							? 'text-income'
							: 'text-expense'}"
					>
						{group.netCents >= 0 ? '+' : '−'}{formatCentsAsCurrency(
							Math.abs(group.netCents),
							currency
						)}
					</span>
				{/if}
			</div>
			<ul class="space-y-2">
				{#each group.items as tx (tx.id)}
					{@const acc = accountById.get(tx.accountId)}
					{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
					{@const RowIcon =
						tx.kind === 'transfer' ? ArrowLeftRight : (getIconByName(cat?.icon) ?? Tag)}
					{@const rowTint =
						cat?.color ??
						(tx.kind === 'income' ? '#10b981' : tx.kind === 'transfer' ? '#3b82f6' : '#94a3b8')}
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
							<span
								class="text-sm font-semibold whitespace-nowrap tabular-nums {tx.kind === 'expense'
									? 'text-expense'
									: tx.kind === 'income'
										? 'text-income'
										: 'text-transfer'}"
							>
								{tx.kind === 'expense'
									? '−'
									: tx.kind === 'income'
										? '+'
										: ''}{formatCentsAsCurrency(tx.amountCents, acc?.currency ?? currency)}
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
			icon={Tag}
			title="No transactions yet"
			description="Transactions tagged with this category will appear here."
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
