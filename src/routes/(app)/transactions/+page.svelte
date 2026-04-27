<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Plus, MoreHorizontal, Pencil, Trash2, ArrowLeftRight, Filter, X, Tag } from 'lucide-svelte';
	import { getIconByName } from '$lib/utils/category-icons.js';
	import { formatCentsAsCurrency } from '$lib/utils/money.js';
	import { notify } from '$lib/utils/toast.js';
	import EmptyState from '$lib/components/empty-state.svelte';
	import SegmentedControl from '$lib/components/ui/segmented-control.svelte';
	import PickerSheet, { type PickerItem, type PickerGroup } from '$lib/components/ui/picker-sheet.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AddTransactionSheet from '$lib/components/forms/add-transaction-sheet.svelte';
	import { openAddTransaction } from '$lib/stores/add-transaction.svelte.js';

	let { data, form } = $props();

	type TxRow = (typeof data.transactions)[number];

	let editOpen = $state(false);
	let editTarget = $state<TxRow | null>(null);

	let filterOpen = $state(false);
	let fFrom = $state(data.filter.from ?? '');
	let fTo = $state(data.filter.to ?? '');
	let fAccount = $state(data.filter.accountId ?? '');
	let fCategory = $state(data.filter.categoryId ?? '');
	let fKind = $state(data.filter.kind ?? '');

	const accountById = $derived(new Map(data.accounts.map((a) => [a.id, a])));
	const categoryById = $derived(new Map(data.categories.map((c) => [c.id, c])));

	const formatAmount = (cents: number, currency: string) => formatCentsAsCurrency(cents, currency);

	const formatDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

	const openEdit = (t: TxRow) => {
		editTarget = t;
		editOpen = true;
	};

	type Chip = { key: string; label: string; remove: () => void };
	const chips = $derived.by<Chip[]>(() => {
		const out: Chip[] = [];
		if (data.filter.from) out.push({ key: 'from', label: `From: ${data.filter.from}`, remove: () => removeParam('from') });
		if (data.filter.to) out.push({ key: 'to', label: `To: ${data.filter.to}`, remove: () => removeParam('to') });
		if (data.filter.accountId) {
			const a = accountById.get(data.filter.accountId);
			out.push({ key: 'account', label: a?.name ?? 'Account', remove: () => removeParam('account') });
		}
		if (data.filter.categoryId) {
			const c = categoryById.get(data.filter.categoryId);
			out.push({ key: 'category', label: c?.name ?? 'Category', remove: () => removeParam('category') });
		}
		if (data.filter.kind) out.push({ key: 'kind', label: data.filter.kind, remove: () => removeParam('kind') });
		return out;
	});

	function removeParam(key: string) {
		const params = new URLSearchParams(window.location.search);
		params.delete(key);
		goto(`?${params.toString()}`, { keepFocus: true });
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (fFrom) params.set('from', fFrom);
		if (fTo) params.set('to', fTo);
		if (fAccount) params.set('account', fAccount);
		if (fCategory) params.set('category', fCategory);
		if (fKind) params.set('kind', fKind);
		filterOpen = false;
		goto(`?${params.toString()}`);
	}

	function resetFilters() {
		fFrom = fTo = fAccount = fCategory = fKind = '';
		filterOpen = false;
		goto('?');
	}

	const accountItems = $derived<PickerItem[]>([
		{ value: '', label: 'All accounts' },
		...data.accounts.map((a) => ({ value: a.id, label: a.name }))
	]);

	const categoryItems = $derived<PickerGroup[]>([
		{ label: 'All', items: [{ value: '', label: 'All categories' }] },
		{ label: 'Expense', items: data.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name })) },
		{ label: 'Income', items: data.categories.filter((c) => c.kind === 'income').map((c) => ({ value: c.id, label: c.name })) }
	]);

	const filterKindOptions = [
		{ value: '', label: 'All' },
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' },
		{ value: 'transfer', label: 'Transfer' }
	];

	const totalIncome = $derived(data.transactions.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountCents, 0));
	const totalExpense = $derived(data.transactions.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amountCents, 0));
	const txCurrency = $derived(data.accounts[0]?.currency ?? 'IDR');
</script>

<svelte:head><title>Transactions — Mavlo</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-xl sm:text-2xl font-semibold tracking-tight">Transactions</h1>
	</div>
	<Button class="hidden md:inline-flex" onclick={() => openAddTransaction('expense')}>
		<Plus class="size-4 mr-1" /> New transaction
	</Button>
</div>

<Card.Root class="mb-6">
	<Card.Content class="grid grid-cols-2 gap-4 p-4">
		<div>
			<p class="text-xs text-muted-foreground">Income</p>
			<p class="text-lg sm:text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
				{formatCentsAsCurrency(totalIncome, txCurrency)}
			</p>
		</div>
		<div>
			<p class="text-xs text-muted-foreground">Expense</p>
			<p class="text-lg sm:text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
				{formatCentsAsCurrency(totalExpense, txCurrency)}
			</p>
		</div>
	</Card.Content>
</Card.Root>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

<!-- Mobile chip bar -->
<div class="md:hidden mb-4 flex items-center gap-2 overflow-x-auto">
	{#if chips.length === 0}
		<button
			type="button"
			onclick={() => (filterOpen = true)}
			class="inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-input bg-background text-sm shrink-0"
		>
			<Filter class="size-4" />
			Filter
		</button>
	{:else}
		{#each chips as chip (chip.key)}
			<span class="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-accent text-accent-foreground text-xs shrink-0">
				{chip.label}
				<button type="button" onclick={chip.remove} aria-label="Remove filter">
					<X class="size-3" />
				</button>
			</span>
		{/each}
		<button
			type="button"
			onclick={() => (filterOpen = true)}
			class="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-input text-xs shrink-0"
		>
			<Filter class="size-3" />
			Edit
		</button>
	{/if}
</div>

<!-- Desktop filter form -->
<Card.Root class="hidden md:block mb-6">
	<Card.Content class="p-4">
		<form method="GET" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
			<div class="space-y-1">
				<Label for="filter-from">From</Label>
				<Input id="filter-from" type="date" name="from" value={data.filter.from} />
			</div>
			<div class="space-y-1">
				<Label for="filter-to">To</Label>
				<Input id="filter-to" type="date" name="to" value={data.filter.to} />
			</div>
			<div class="space-y-1">
				<Label>Account</Label>
				<PickerSheet items={accountItems} bind:value={fAccount} name="account" placeholder="All" title="Account" />
			</div>
			<div class="space-y-1">
				<Label>Category</Label>
				<PickerSheet groups={categoryItems} bind:value={fCategory} name="category" placeholder="All" title="Category" searchable />
			</div>
			<div class="space-y-1">
				<Label>Kind</Label>
				<SegmentedControl options={filterKindOptions} bind:value={fKind} name="kind" />
			</div>
			<Button type="submit" class="w-full md:w-auto">Apply</Button>
		</form>
	</Card.Content>
</Card.Root>

<!-- Mobile filter sheet -->
<Sheet.Root bind:open={filterOpen}>
	<Sheet.Content side="bottom" class="max-h-[90dvh] flex flex-col p-0">
		<Sheet.Header class="text-left p-4 pb-2">
			<Sheet.Title>Filter transactions</Sheet.Title>
		</Sheet.Header>
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="m-from">From</Label>
					<Input id="m-from" type="date" bind:value={fFrom} />
				</div>
				<div class="space-y-1">
					<Label for="m-to">To</Label>
					<Input id="m-to" type="date" bind:value={fTo} />
				</div>
			</div>
			<div class="space-y-1">
				<Label>Account</Label>
				<PickerSheet items={accountItems} bind:value={fAccount} placeholder="All accounts" title="Account" />
			</div>
			<div class="space-y-1">
				<Label>Category</Label>
				<PickerSheet groups={categoryItems} bind:value={fCategory} placeholder="All categories" title="Category" searchable />
			</div>
			<div class="space-y-1">
				<Label>Kind</Label>
				<SegmentedControl options={filterKindOptions} bind:value={fKind} />
			</div>
		</div>
		<div class="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
			<Button variant="outline" class="flex-1" onclick={resetFilters}>Reset</Button>
			<Button class="flex-1" onclick={applyFilters}>Apply</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>

{#snippet rowMenu(tx: TxRow)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" class="size-11 md:size-8 shrink-0">
					<MoreHorizontal class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={() => openEdit(tx)}>
				<Pencil class="size-4 mr-2" /> Edit
			</DropdownMenu.Item>
			<form method="POST" action="?/delete" use:enhance={() => async ({ result }) => {
					await goto(page.url.pathname + page.url.search, {
						invalidateAll: true,
						replaceState: true,
						keepFocus: true,
						noScroll: true
					});
					if (result.type === 'success') {
						notify.success('Transaction deleted');
					} else if (result.type === 'failure') {
						const message = (result.data as { message?: string } | undefined)?.message;
						notify.error(message ?? 'Could not delete transaction');
					}
				}}>
				<input type="hidden" name="id" value={tx.id} />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button
							{...props}
							type="submit"
							class="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left text-destructive rounded-sm hover:bg-accent/50"
						>
							<Trash2 class="size-4" /> Delete
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</form>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

<div class="hidden md:block">
	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Date</Table.Head>
						<Table.Head>Kind</Table.Head>
						<Table.Head>Account</Table.Head>
						<Table.Head>Category</Table.Head>
						<Table.Head>Note</Table.Head>
						<Table.Head class="text-right">Amount</Table.Head>
						<Table.Head class="w-12"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.transactions as tx (tx.id)}
						{@const acc = accountById.get(tx.accountId)}
						{@const destAcc = tx.transferToAccountId ? accountById.get(tx.transferToAccountId) : null}
						{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
						<Table.Row>
							<Table.Cell>{formatDate(tx.occurredAt)}</Table.Cell>
							<Table.Cell class="capitalize">
								{#if tx.kind === 'income'}
									<span class="text-emerald-600 dark:text-emerald-400">income</span>
								{:else if tx.kind === 'expense'}
									<span class="text-rose-600 dark:text-rose-400">expense</span>
								{:else}
									<span class="text-blue-600 dark:text-blue-400">transfer</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if tx.kind === 'transfer' && destAcc}
									<span class="text-xs">{acc?.name ?? '—'} → {destAcc.name}</span>
								{:else}
									{acc?.name ?? '—'}
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if tx.kind === 'transfer'}
									<span class="text-muted-foreground text-xs">—</span>
								{:else}
									{cat?.name ?? '—'}
								{/if}
							</Table.Cell>
							<Table.Cell class="max-w-xs truncate">{tx.note ?? ''}</Table.Cell>
							<Table.Cell class="text-right tabular-nums">
								{#if tx.kind === 'expense'}
									<span class="text-rose-600 dark:text-rose-400">−{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
								{:else if tx.kind === 'income'}
									<span class="text-emerald-600 dark:text-emerald-400">+{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
								{:else}
									<span class="text-blue-600 dark:text-blue-400">{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{@render rowMenu(tx)}
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={7} class="p-0">
								<EmptyState icon={ArrowLeftRight} title="No transactions in this range" description="Try a different date range or add a new transaction.">
									<Button onclick={() => openAddTransaction('expense')}>Add transaction</Button>
								</EmptyState>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

<ul class="md:hidden space-y-2">
	{#each data.transactions as tx (tx.id)}
		{@const acc = accountById.get(tx.accountId)}
		{@const destAcc = tx.transferToAccountId ? accountById.get(tx.transferToAccountId) : null}
		{@const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null}
		{@const IconComp = tx.kind === 'transfer' ? ArrowLeftRight : (getIconByName(cat?.icon) ?? Tag)}
		{@const tint = cat?.color ?? (tx.kind === 'income' ? '#10b981' : tx.kind === 'transfer' ? '#3b82f6' : '#94a3b8')}
		<li class="rounded-lg border bg-card p-3 flex items-center gap-3">
			<div class="size-10 shrink-0 rounded-lg flex items-center justify-center" style="background-color: {tint}20; color: {tint}">
				<IconComp class="size-5" />
			</div>
			<div class="flex-1 min-w-0">
				<div class="text-sm font-medium truncate">
					{tx.note || cat?.name || acc?.name || 'Transaction'}
				</div>
				<div class="text-xs text-muted-foreground truncate">
					<span class="tabular-nums">{formatDate(tx.occurredAt)}</span>
					· {acc?.name ?? '—'}
					{#if tx.kind === 'transfer' && destAcc} → {destAcc.name}{/if}
				</div>
			</div>
			<div class="flex items-center gap-1 shrink-0">
				<span class="text-sm font-semibold tabular-nums whitespace-nowrap {tx.kind === 'expense' ? 'text-rose-600 dark:text-rose-400' : tx.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}">
					{tx.kind === 'expense' ? '−' : tx.kind === 'income' ? '+' : ''}{formatAmount(tx.amountCents, acc?.currency ?? 'IDR')}
				</span>
				{@render rowMenu(tx)}
			</div>
		</li>
	{:else}
		<li>
			<EmptyState icon={ArrowLeftRight} title="No transactions in this range" description="Try a different date range or add a new transaction.">
				<Button onclick={() => openAddTransaction('expense')}>Add transaction</Button>
			</EmptyState>
		</li>
	{/each}
</ul>

<!-- Edit sheet -->
<AddTransactionSheet
	bind:open={editOpen}
	mode="edit"
	accounts={data.accounts}
	categories={data.categories}
	editTarget={editTarget ? {
		id: editTarget.id,
		kind: editTarget.kind,
		amountCents: editTarget.amountCents,
		accountId: editTarget.accountId,
		transferToAccountId: editTarget.transferToAccountId,
		categoryId: editTarget.categoryId,
		occurredAt: editTarget.occurredAt,
		note: editTarget.note
	} : null}
	actionUrl="?/update"
	onClose={() => (editOpen = false)}
/>
